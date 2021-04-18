import type {ValheimCtlConfig} from "./config";
import {OdinState, scaleStatefulSet} from "./kubernetes";
import {asNumber, asObject, asOptional} from "./util";

const KEY = "OdinObservation";

export interface OdinObservation {
    instant: number;
    numPlayers: number | null;
}

export const OdinObservation = {
    async get(config: ValheimCtlConfig): Promise<OdinObservation | null> {
        const json = await config.kv.get(KEY);
        if (json == null) {
            return null;
        }

        const obj = asObject(JSON.parse(json));
        return {
            instant: asNumber(obj["instant"]),
            numPlayers: asOptional(asNumber, obj["numPlayers"]),
        };
    },

    async put(config: ValheimCtlConfig, observation: OdinObservation): Promise<void> {
        await config.kv.put(KEY, JSON.stringify(observation));
    },

    async observe(config: ValheimCtlConfig): Promise<OdinObservation> {
        const odinState = await OdinState.fromApi(config);
        return {
            instant: Date.now(),
            numPlayers: odinState.isOnline() ? odinState.numPlayers() : null,
        };
    },
};

function combineSuccessiveObservations({
    oldObservation,
    newObservation,
}: {
    oldObservation: OdinObservation | null;
    newObservation: OdinObservation;
}): {
    observation: OdinObservation;
    hasChanged: boolean;
} {
    if (
        oldObservation == null ||
        newObservation.numPlayers !== oldObservation.numPlayers
    ) {
        return {
            observation: newObservation,
            hasChanged: true,
        };
    }

    return {
        observation: oldObservation,
        hasChanged: false,
    };
}

function shouldShutdown({
    observation,
    timeout,
}: {
    observation: OdinObservation;
    timeout: number;
}): boolean {
    return observation.numPlayers != null && Date.now() - observation.instant > timeout;
}

export async function observeAndPossiblyShutdown(
    config: ValheimCtlConfig,
): Promise<void> {
    const {idleShutdownAfterMs} = config;
    if (idleShutdownAfterMs == null) {
        throw new Error("Shutdown not configured");
    }

    const [oldObservation, newObservation] = await Promise.all([
        OdinObservation.get(config),
        OdinObservation.observe(config),
    ]);

    const combined = combineSuccessiveObservations({
        oldObservation,
        newObservation,
    });

    const pending: Array<Promise<unknown>> = [];

    if (combined.hasChanged) {
        pending.push(OdinObservation.put(config, combined.observation));
    }

    if (
        shouldShutdown({
            observation: combined.observation,
            timeout: idleShutdownAfterMs,
        })
    ) {
        pending.push(scaleStatefulSet({config, replicas: 0}));
    }

    await Promise.all(pending);
}
