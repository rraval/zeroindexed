import fs from "fs";

import * as cloudflare from "@pulumi/cloudflare";
import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
import {ExternalServiceAccount} from "@zeroindexed/k8s-external-service-account";
import type {ValheimServer} from "@zeroindexed/valheim";

const WORKER_SCRIPT = fs.promises.readFile(
    require.resolve("@zeroindexed/valheimctl-worker"),
    {encoding: "utf8"},
);

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
        {parent: props.parent},
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
        {parent: props.parent},
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

export interface ValheimCtlArgs {
    server: ValheimServer;
    cloudflareZone: pulumi.Input<string>;
    cloudflareZoneId: pulumi.Input<string>;
    clusterEndpointIp: pulumi.Input<string>;
    password?: pulumi.Input<string>;
    actorLogTtl?: pulumi.Input<number>;
    idleShutdown?: {
        schedule: pulumi.Input<string>;
        after: pulumi.Input<number>;
        logTtl?: pulumi.Input<number>;
    };
}

export class ValheimCtl extends pulumi.ComponentResource {
    public constructor(
        name: string,
        args: ValheimCtlArgs,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super("zeroindexed:valheimctl", name, args, opts);
        const {
            server,
            cloudflareZone,
            cloudflareZoneId,
            clusterEndpointIp,
            password,
            actorLogTtl,
            idleShutdown,
        } = args;

        const metadata = {
            labels: {
                "app.kubernetes.io/name": "valheimctl",
            },
        };

        const serviceAccount = new ExternalServiceAccount(
            "valheimctl",
            {metadata},
            {parent: this},
        );

        makeRoleAndBinding({
            name: "valheimctl-odin-proxy",
            metadata,
            serviceAccountName: serviceAccount.account.metadata.name,
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
            serviceAccountName: serviceAccount.account.metadata.name,
            apiGroups: [""],
            resources: ["pods"],
            resourceNames: [podName],
            verbs: ["get"],
            parent: this,
        });

        makeRoleAndBinding({
            name: "valheimctl-statefulset-get",
            metadata,
            serviceAccountName: serviceAccount.account.metadata.name,
            apiGroups: ["apps"],
            resources: ["statefulsets"],
            resourceNames: [server.statefulSet.metadata.name],
            verbs: ["get"],
            parent: this,
        });

        makeRoleAndBinding({
            name: "valheimctl-statefulset-scale",
            metadata,
            serviceAccountName: serviceAccount.account.metadata.name,
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

        const secretTextBindings: Array<cloudflare.types.input.WorkerScriptSecretTextBinding> = [
            {
                name: "VALHEIMCTL_K8S_TOKEN",
                text: serviceAccount.token,
            },
        ];

        if (password !== undefined) {
            secretTextBindings.push({
                name: "VALHEIMCTL_PASSWORD",
                text: password,
            });
        }

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

        if (actorLogTtl != null) {
            plainTextBindings.push({
                name: "VALHEIMCTL_ACTOR_LOG_TTL",
                text: pulumi.concat(actorLogTtl),
            });
        }

        if (idleShutdown != null) {
            plainTextBindings.push({
                name: "VALHEIMCTL_IDLE_SHUTDOWN_AFTER",
                text: pulumi.concat(idleShutdown.after),
            });

            if (idleShutdown.logTtl != null) {
                plainTextBindings.push({
                    name: "VALHEIMCTL_IDLE_SHUTDOWN_LOG_TTL",
                    text: pulumi.concat(idleShutdown.logTtl),
                });
            }
        }

        const workerScript = new cloudflare.WorkerScript(
            "valheimctl",
            {
                name: "valheimctl",
                content: WORKER_SCRIPT,
                plainTextBindings,
                secretTextBindings,
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
