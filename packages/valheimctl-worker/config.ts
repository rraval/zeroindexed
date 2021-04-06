export interface ValheimCtlConfig {
    k8sGateway: string;
    k8sToken: string;
    namespace: string;
    statefulSetName: string;
    podName: string;
    odinName: string;
    password: string;
}

export const ValheimCtlConfig = {
    fromGlobalThis(): ValheimCtlConfig {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const env = globalThis as any;

        return {
            k8sGateway: env.VALHEIMCTL_K8S_GATEWAY,
            k8sToken: env.VALHEIMCTL_K8S_TOKEN,
            namespace: env.VALHEIMCTL_NAMESPACE,
            statefulSetName: env.VALHEIMCTL_STATEFUL_SET_NAME,
            podName: env.VALHEIMCTL_POD_NAME,
            odinName: env.VALHEIMCTL_ODIN_NAME,
            password: env.VALHEIMCTL_PASSWORD,
        };
    }
};
