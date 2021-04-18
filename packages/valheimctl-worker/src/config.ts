import {asStringNumber, asObject, asOptional, asString} from "./util";

export interface ValheimCtlConfig {
    k8sGateway: string;
    k8sToken: string;
    namespace: string;
    statefulSetName: string;
    podName: string;
    odinName: string;
    password: string;
    kv: KVNamespace;
    idleShutdownAfterMs: number | null;
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

        return {
            k8sGateway: asString(env["VALHEIMCTL_K8S_GATEWAY"]),
            k8sToken: asString(env["VALHEIMCTL_K8S_TOKEN"]),
            namespace: asString(env["VALHEIMCTL_NAMESPACE"]),
            statefulSetName: asString(env["VALHEIMCTL_STATEFUL_SET_NAME"]),
            podName: asString(env["VALHEIMCTL_POD_NAME"]),
            odinName: asString(env["VALHEIMCTL_ODIN_NAME"]),
            password: asString(env["VALHEIMCTL_PASSWORD"]),
            kv: asKVNamespace(env["VALHEIMCTL_KV"]),
            idleShutdownAfterMs: asOptional(
                asStringNumber,
                env["VALHEIMCTL_IDLE_SHUTDOWN_AFTER_MS"],
            ),
        };
    },
};
