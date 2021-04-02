import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

export type ValheimPersistentVolumeFactory = (
    name: string,
    opts?: pulumi.ComponentResourceOptions,
) => k8s.core.v1.PersistentVolume;

class ValheimDisk extends pulumi.ComponentResource {
    readonly persistentVolume: k8s.core.v1.PersistentVolume;
    readonly persistentVolumeClaim: k8s.core.v1.PersistentVolumeClaim;

    public constructor(
        name: string,
        persistentVolumeFactory: ValheimPersistentVolumeFactory,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super("rrv:valheim:disk", name, {}, opts);

        this.persistentVolume = persistentVolumeFactory(name, {
            parent: this,
        });

        this.persistentVolumeClaim = new k8s.core.v1.PersistentVolumeClaim(
            name,
            {
                spec: {
                    accessModes: this.persistentVolume.spec.accessModes,
                    resources: {
                        requests: {
                            storage: this.persistentVolume.spec.capacity["storage"],
                        },
                    },
                    volumeName: this.persistentVolume.metadata.name,
                    storageClassName: this.persistentVolume.spec.storageClassName,
                },
            },
            {
                parent: this,
            },
        );
    }
}

export class ValheimServer extends pulumi.ComponentResource {
    readonly configDisk: ValheimDisk;
    readonly steamDisk: ValheimDisk;
    readonly backupDisk: ValheimDisk;

    readonly secret: k8s.core.v1.Secret;
    readonly service: k8s.core.v1.Service;
    readonly statefulSet: k8s.apps.v1.StatefulSet;

    public constructor(
        name: string,
        props: {
            configVolumeFactory: ValheimPersistentVolumeFactory;
            steamVolumeFactory: ValheimPersistentVolumeFactory;
            backupVolumeFactory: ValheimPersistentVolumeFactory;
            isRunning: pulumi.Input<boolean>;
            ip: pulumi.Input<string>;
            cpu: pulumi.Input<string>;
            memory: pulumi.Input<string>;
            timeZone: pulumi.Input<string>;
            serverName: pulumi.Input<string>;
            worldName: pulumi.Input<string>;
            password: pulumi.Input<string>;
            webhookUrl?: pulumi.Input<string>;
        },
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super("rrv:valheim:server", name, {}, opts);

        this.configDisk = new ValheimDisk("valheim-config", props.configVolumeFactory, {
            parent: this,
        });

        this.steamDisk = new ValheimDisk("valheim-steam", props.steamVolumeFactory, {
            parent: this,
        });

        this.backupDisk = new ValheimDisk("valheim-backup", props.backupVolumeFactory, {
            parent: this,
        });

        const labels = {
            "app.kubernetes.io/name": "valheim",
        };

        const ports = [2456, 2457, 2458];

        this.service = new k8s.core.v1.Service(
            "valheim",
            {
                metadata: {
                    labels,
                    annotations: {
                        // This service scales down to 0 replicas, this is the
                        // documented workaround:
                        // https://www.pulumi.com/docs/reference/pkg/kubernetes/core/v1/service/
                        // https://github.com/pulumi/pulumi-kubernetes/pull/703
                        "pulumi.com/skipAwait": "true",
                    },
                },
                spec: {
                    selector: labels,
                    type: "LoadBalancer",
                    loadBalancerIP: props.ip,
                    ports: ports.map((port, index) => {
                        return {
                            port,
                            protocol: "UDP",
                            name: `port${index}`,
                        };
                    }),
                },
            },
            {
                parent: this,
            },
        );

        const secretStringData: {[Key: string]: pulumi.Input<string>} = {
            password: props.password,
        };

        if (props.webhookUrl !== undefined) {
            secretStringData["webhookUrl"] = props.webhookUrl;
        }

        this.secret = new k8s.core.v1.Secret(
            "valheim",
            {
                metadata: {labels},
                stringData: secretStringData,
            },
            {
                parent: this,
            },
        );

        const persistence = [
            {
                name: "config",
                mountPath: "/home/steam/.config/unity3d/IronGate/Valheim",
                disk: this.configDisk,
            },
            {
                name: "steam",
                mountPath: "/home/steam/valheim",
                disk: this.steamDisk,
            },
            {
                name: "backup",
                mountPath: "/home/steam/backups",
                disk: this.backupDisk,
            },
        ];

        const env = [
            {
                name: "TZ",
                value: props.timeZone,
            },
            {
                name: "NAME",
                value: props.serverName,
            },
            {
                name: "WORLD",
                value: props.worldName,
            },
            {
                name: "PASSWORD",
                valueFrom: {
                    secretKeyRef: {
                        name: this.secret.metadata.name,
                        key: "password",
                    },
                },
            },
            {
                name: "WEBHOOK_URL",
                valueFrom: {
                    secretKeyRef: {
                        name: this.secret.metadata.name,
                        key: "webhookUrl",
                        optional: true,
                    },
                },
            },
            {
                name: "AUTO_BACKUP",
                value: "1",
            },
            {
                name: "AUTO_BACKUP_ON_UPDATE",
                value: "1",
            },
            {
                name: "AUTO_BACKUP_ON_SHUTDOWN",
                value: "1",
            },
        ];

        this.statefulSet = new k8s.apps.v1.StatefulSet(
            "valheim",
            {
                metadata: {
                    labels,
                },
                spec: {
                    serviceName: this.service.metadata.name,
                    selector: {
                        matchLabels: labels,
                    },
                    replicas: pulumi.output(props.isRunning).apply((isRunning) => {
                        return isRunning ? 1 : 0;
                    }),
                    template: {
                        metadata: {
                            labels,
                        },
                        spec: {
                            containers: [
                                {
                                    name: "game",
                                    image: "ghcr.io/mbround18/valheim:latest",
                                    ports: ports.map((port) => {
                                        return {
                                            containerPort: port,
                                            protocol: "UDP",
                                        };
                                    }),
                                    volumeMounts: persistence.map(
                                        ({name, mountPath}) => {
                                            return {name, mountPath};
                                        },
                                    ),
                                    resources: {
                                        requests: {
                                            cpu: props.cpu,
                                            memory: props.memory,
                                        },
                                    },
                                    env,
                                },
                            ],
                            volumes: persistence.map(({name, disk}) => {
                                return {
                                    name,
                                    persistentVolumeClaim: {
                                        claimName:
                                            disk.persistentVolumeClaim.metadata.name,
                                    },
                                };
                            }),
                        },
                    },
                },
            },
            {
                parent: this,
            },
        );
    }
}
