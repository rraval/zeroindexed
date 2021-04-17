import type {ValheimCtlConfig} from "./config";
import {OdinState, scaleStatefulSet} from "./kubernetes";
import {KV} from "./kv";
import {asNumber, asObject, asOptional} from "./util";

export interface OdinObservation {
    instant: number;
    numPlayers: number | null;
}

export const OdinObservation = {
    async get(config: ValheimCtlConfig): Promise<OdinObservation | null> {
        const json = await config.kv.get(KV.odinObservation);
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
        await config.kv.put(KV.odinObservation, JSON.stringify(observation));
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
    return (
        observation.numPlayers != null &&
        Date.now() - observation.instant > timeout * 1000
    );
}

export async function observeAndPossiblyShutdown(
    config: ValheimCtlConfig,
): Promise<void> {
    const {idleShutdownAfter} = config;
    if (idleShutdownAfter == null) {
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
    const log = (message: string): void => {
        const promise = config.idleShutdownLogger?.log(message);
        if (promise != null) {
            pending.push(promise);
        }
    };

    if (combined.hasChanged) {
        log(`Observed ${combined.observation.numPlayers} players`);
        pending.push(OdinObservation.put(config, combined.observation));
    }

    if (
        shouldShutdown({
            observation: combined.observation,
            timeout: idleShutdownAfter,
        })
    ) {
        log(`Server has been idle for ${idleShutdownAfter}s, shutting down`);
        pending.push(scaleStatefulSet({config, replicas: 0}));
    }

    await Promise.all(pending);
}
