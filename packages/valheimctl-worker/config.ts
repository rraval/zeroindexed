import {asNumberString, asObject, asString} from "./util";

export interface ValheimCtlConfig {
    k8sGateway: string;
    k8sToken: string;
    namespace: string;
    statefulSetName: string;
    podName: string;
    odinName: string;
    password: string;
    idleShutdown: null | {
        kv: KVNamespace;
        afterMs: number;
    };
}

function asKVNamespace(thing: unknown): KVNamespace {
    const obj = asObject(thing);
    if (obj["get"] == null || obj["put"] == null) {
        throw new Error(`Expected KVNamespace, got ${Object.keys(obj)}`);
    }

    return thing as KVNamespace;
}

export const ValheimCtlConfig = {
    fromGlobalThis(): ValheimCtlConfig {
        const env = globalThis as Record<string, unknown>;

        const idleShutdownKv = env["VALHEIMCTL_KV"];
        const idleShutdownAfterMs = env["VALHEIMCTL_IDLE_SHUTDOWN_AFTER_MS"];

        return {
            k8sGateway: asString(env["VALHEIMCTL_K8S_GATEWAY"]),
            k8sToken: asString(env["VALHEIMCTL_K8S_TOKEN"]),
            namespace: asString(env["VALHEIMCTL_NAMESPACE"]),
            statefulSetName: asString(env["VALHEIMCTL_STATEFUL_SET_NAME"]),
            podName: asString(env["VALHEIMCTL_POD_NAME"]),
            odinName: asString(env["VALHEIMCTL_ODIN_NAME"]),
            password: asString(env["VALHEIMCTL_PASSWORD"]),
            idleShutdown: idleShutdownKv == null || idleShutdownAfterMs == null ? null : {
                kv: asKVNamespace(idleShutdownKv),
                afterMs: asNumberString(idleShutdownAfterMs),
            },
        };
    },
};
