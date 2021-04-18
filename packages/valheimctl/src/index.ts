import * as cloudflare from "@pulumi/cloudflare";
import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
import type {ValheimServer} from "@zeroindexed/valheim";
import {webpacker} from "@zeroindexed/webpacker";

function makeRoleAndBinding(props: {
    name: string;
    metadata: pulumi.Input<k8s.types.input.meta.v1.ObjectMeta>;
    serviceAccountName: pulumi.Input<string>;
    apiGroups: pulumi.Input<Array<pulumi.Input<string>>>;
    resources: pulumi.Input<Array<pulumi.Input<string>>>;
    resourceNames: pulumi.Input<Array<pulumi.Input<string>>>;
    verbs: pulumi.Input<Array<pulumi.Input<string>>>;
    parent: pulumi.Resource;
}): [k8s.rbac.v1.Role, k8s.rbac.v1.RoleBinding] {
    const role = new k8s.rbac.v1.Role(
        props.name,
        {
            metadata: props.metadata,
            rules: [
                {
                    apiGroups: props.apiGroups,
                    resources: props.resources,
                    resourceNames: props.resourceNames,
                    verbs: props.verbs,
                },
            ],
        },
        {
            parent: props.parent,
        },
    );

    const roleBinding = new k8s.rbac.v1.RoleBinding(
        props.name,
        {
            metadata: props.metadata,
            subjects: [
                {
                    kind: "ServiceAccount",
                    name: props.serviceAccountName,
                },
            ],
            roleRef: {
                kind: "Role",
                name: role.metadata.name,
                apiGroup: "rbac.authorization.k8s.io",
            },
        },
        {
            parent: props.parent,
        },
    );

    return [role, roleBinding];
}

function makeUrl(
    subdomain: string,
    zone: pulumi.Input<string>,
    path?: string,
): pulumi.Output<string> {
    return pulumi.concat(`https://${subdomain}.`, zone, path == null ? "" : `/${path}`);
}

export class ValheimCtl extends pulumi.ComponentResource {
    public constructor(
        name: string,
        {
            server,
            cloudflareZone,
            cloudflareZoneId,
            clusterEndpointIp,
            password,
            idleShutdown,
        }: {
            server: ValheimServer;
            cloudflareZone: pulumi.Input<string>;
            cloudflareZoneId: pulumi.Input<string>;
            clusterEndpointIp: pulumi.Input<string>;
            password: pulumi.Input<string>;
            idleShutdown?: {
                schedule: pulumi.Input<string>;
                afterMs: pulumi.Input<number>;
            };
        },
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super("zeroindexed:valheimctl:ctl", name, {}, opts);

        const metadata = {
            labels: {
                "app.kubernetes.io/name": "valheimctl",
            },
        };

        const serviceAccount = new k8s.core.v1.ServiceAccount(
            "valheimctl",
            {metadata},
            {parent: this},
        );

        const serviceAccountTokenSecret = k8s.core.v1.Secret.get(
            "valheimctl-token",
            serviceAccount.secrets.apply((secretArray) => {
                if (secretArray.length !== 1) {
                    throw new Error(
                        `Expected just a single secret token, got: ${secretArray.length}`,
                    );
                }

                return secretArray[0].name;
            }),
            {parent: this},
        );

        const serviceAccountToken = serviceAccountTokenSecret.data["token"].apply(
            (encodedSecretToken) => {
                return Buffer.from(encodedSecretToken, "base64").toString("utf8");
            },
        );

        makeRoleAndBinding({
            name: "valheimctl-odin-proxy",
            metadata,
            serviceAccountName: serviceAccount.metadata.name,
            apiGroups: [""],
            resources: ["services/proxy"],
            resourceNames: [server.odinService.metadata.name],
            verbs: ["get"],
            parent: this,
        });

        const podName = pulumi.concat(server.statefulSet.metadata.name, "-0");

        makeRoleAndBinding({
            name: "valheimctl-pod-get",
            metadata,
            serviceAccountName: serviceAccount.metadata.name,
            apiGroups: [""],
            resources: ["pods"],
            resourceNames: [podName],
            verbs: ["get"],
            parent: this,
        });

        makeRoleAndBinding({
            name: "valheimctl-statefulset-get",
            metadata,
            serviceAccountName: serviceAccount.metadata.name,
            apiGroups: ["apps"],
            resources: ["statefulsets"],
            resourceNames: [server.statefulSet.metadata.name],
            verbs: ["get"],
            parent: this,
        });

        makeRoleAndBinding({
            name: "valheimctl-statefulset-scale",
            metadata,
            serviceAccountName: serviceAccount.metadata.name,
            apiGroups: ["apps"],
            resources: ["statefulsets/scale"],
            resourceNames: [server.statefulSet.metadata.name],
            verbs: ["patch"],
            parent: this,
        });

        new cloudflare.Record("valheimctl-k8s", {
            zoneId: cloudflareZoneId,
            name: "valheimctl-k8s",
            value: clusterEndpointIp,
            type: "A",
            proxied: true,
        });

        new cloudflare.Record(
            "valheimctl",
            {
                zoneId: cloudflareZoneId,
                name: "valheimctl",
                type: "AAAA",
                value: "100::",
                proxied: true,
            },
            {parent: this},
        );

        const plainTextBindings: Array<cloudflare.types.input.WorkerScriptPlainTextBinding> = [
            {
                name: "VALHEIMCTL_K8S_GATEWAY",
                text: makeUrl("valheimctl-k8s", cloudflareZone),
            },
            {
                name: "VALHEIMCTL_NAMESPACE",
                text: server.statefulSet.metadata.namespace,
            },
            {
                name: "VALHEIMCTL_STATEFUL_SET_NAME",
                text: server.statefulSet.metadata.name,
            },
            {
                name: "VALHEIMCTL_POD_NAME",
                text: podName,
            },
            {
                name: "VALHEIMCTL_ODIN_NAME",
                text: server.odinService.metadata.name,
            },
        ];

        const kv = new cloudflare.WorkersKvNamespace(
            "valheimctl-kv",
            {title: "valheimctl-kv"},
            {parent: this},
        );
        const kvNamespaceBindings: Array<cloudflare.types.input.WorkerScriptKvNamespaceBinding> = [
            {
                name: "VALHEIMCTL_KV",
                namespaceId: kv.id,
            },
        ];

        if (idleShutdown != null) {
            plainTextBindings.push({
                name: "VALHEIMCTL_IDLE_SHUTDOWN_AFTER_MS",
                text: pulumi.concat(idleShutdown.afterMs),
            });
        }

        const workerScript = new cloudflare.WorkerScript(
            "valheimctl",
            {
                name: "valheimctl",
                content: webpacker({
                    module: "@zeroindexed/valheimctl-worker",
                    webpackConfigName: "../webpack.wrangler.js",
                }),
                plainTextBindings,
                secretTextBindings: [
                    {
                        name: "VALHEIMCTL_K8S_TOKEN",
                        text: serviceAccountToken,
                    },
                    {
                        name: "VALHEIMCTL_PASSWORD",
                        text: password,
                    },
                ],
                kvNamespaceBindings,
            },
            {parent: this},
        );

        if (idleShutdown != null) {
            new cloudflare.WorkerCronTrigger(
                "valheimctl",
                {
                    scriptName: workerScript.name,
                    schedules: [idleShutdown.schedule],
                },
                {parent: this},
            );
        }

        new cloudflare.WorkerRoute(
            "valheimctl",
            {
                zoneId: cloudflareZoneId,
                pattern: makeUrl("valheimctl", cloudflareZone, "*"),
                scriptName: workerScript.name,
            },
            {parent: this},
        );
    }
}
