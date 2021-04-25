import * as gcp from "@pulumi/gcp";
import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import type {Config} from "./config";

export function makeKubernetes(
    config: Config,
): {
    cluster: gcp.container.Cluster;
    provider: k8s.Provider;
} {
    const cluster = new gcp.container.Cluster(
        config.kubernetes.clusterName,
        {
            enableBinaryAuthorization: false,
            enableIntranodeVisibility: true,
            enableKubernetesAlpha: false,
            enableLegacyAbac: false,
            enableShieldedNodes: true,
            enableTpu: false,
            name: config.kubernetes.clusterName,
            network: "default",
            verticalPodAutoscaling: {
                enabled: true,
            },
            workloadIdentityConfig: {
                identityNamespace: `${gcp.config.project}.svc.id.goog`,
            },
        },
        {
            protect: true,
            aliases: [
                {name: config.kubernetes.clusterName},
                {name: "kubernetes-cluster"},
            ],
        },
    );

    const provider = new k8s.Provider(config.kubernetes.clusterName, {
        kubeconfig: pulumi
            .all([cluster.name, cluster.endpoint, cluster.masterAuth])
            .apply(([name, endpoint, masterAuth]) => {
                const context = `${gcp.config.project}_${gcp.config.zone}_${name}`;
                return `apiVersion: v1
clusters:
- cluster:
    certificate-authority-data: ${masterAuth.clusterCaCertificate}
    server: https://${endpoint}
  name: ${context}
contexts:
- context:
    cluster: ${context}
    user: ${context}
  name: ${context}
current-context: ${context}
kind: Config
preferences: {}
users:
- name: ${context}
  user:
    auth-provider:
      config:
        cmd-args: config config-helper --format=json
        cmd-path: gcloud
        expiry-key: '{.credential.token_expiry}'
        token-key: '{.credential.access_token}'
      name: gcp
`;
            }),
    });

    return {cluster, provider};
}
