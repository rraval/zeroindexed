import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

/**
 * A cloud independent way of specifying a persistent volume.
 *
 * ZeroIndexed uses gcePersistentDisk but you don't have to.
 */
export type ValheimPersistentVolumeFactory = (
    name: string,
    opts?: pulumi.ComponentResourceOptions,
) => k8s.core.v1.PersistentVolume;

/**
 * Some form of persistent disk. We map these to explicit PersistentVolume and
 * PersistentVolumeClaim resources for the cluster.
 */
class ValheimDisk extends pulumi.ComponentResource {
    readonly persistentVolume: k8s.core.v1.PersistentVolume;
    readonly persistentVolumeClaim: k8s.core.v1.PersistentVolumeClaim;

    public constructor(
        name: string,
        persistentVolumeFactory: ValheimPersistentVolumeFactory,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super("zeroindexed:valheim:disk", name, {}, opts);

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

/**
 * A Valheim game server, implemented as a StatefulSet mapped to a LoadBalancer
 * service.
 */
export class ValheimServer extends pulumi.ComponentResource {
    readonly configDisk: ValheimDisk;
    readonly steamDisk: ValheimDisk;
    readonly backupDisk: ValheimDisk | undefined;

    readonly secret: k8s.core.v1.Secret;
    readonly gameService: k8s.core.v1.Service;
    readonly odinService: k8s.core.v1.Service;
    readonly statefulSet: k8s.apps.v1.StatefulSet;

    public constructor(
        name: string,
        props: {
            /** Persistent disk for live game data. ~2G is probably good enough. */
            configVolumeFactory: ValheimPersistentVolumeFactory;

            /** Persistent disk for Steam game files. ~10G is probably good enough. */
            steamVolumeFactory: ValheimPersistentVolumeFactory;

            /**
             * Persistent disk for backups of game data.
             *
             * Optional but recommended. ~10G is probably good enough.
             */
            backupVolumeFactory?: ValheimPersistentVolumeFactory;

            /**
             * We support turning the game server off to save money.
             *
             * FIXME: booting up the server requires cluster access and is
             * janky. Build some cloud function nonsense to wrap scaling and
             * status into a web UI.
             */
            isRunning: pulumi.Input<boolean>;

            /**
             * IP address for the game server.
             */
            ip: pulumi.Input<string>;

            /**
             * CPU request for the container, in "cpu units":
             * https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/#meaning-of-cpu
             *
             * 4 CPUs seems like overkill:
             * https://www.reddit.com/r/valheim/comments/lcg8xk/dedicated_server_requirements/
             */
            cpu: pulumi.Input<string>;

            /**
             * Memory request for the container, in bytes or standard prefixes:
             * https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/#meaning-of-memory
             *
             * 4Gi seems about right:
             * https://www.reddit.com/r/valheim/comments/lcg8xk/dedicated_server_requirements/
             */
            memory: pulumi.Input<string>;

            /** Should be a name from the TZ database, like `America/Toronto` */
            timeZone: pulumi.Input<string>;

            /** Displayed by the server search UI in game. */
            serverName: pulumi.Input<string>;

            /**
             * Influences the filename used to represent the game data for a server.
             *
             * Specifying `foo` here will use the `worlds/foo.db` and
             * `worlds/foo.fwl` files from `configVolumeFactory`.
             */
            worldName: pulumi.Input<string>;

            /**
             * In game password for joining a server.
             */
            password: pulumi.Input<string>;

            /**
             * Announces server status via Discord.
             *
             * https://github.com/mbround18/valheim-docker/blob/main/docs/webhooks.md
             */
            webhookUrl?: pulumi.Input<string>;
        },
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super("zeroindexed:valheim:server", name, {}, opts);

        this.configDisk = new ValheimDisk(
            "valheim-config",
            props.configVolumeFactory,
            {parent: this},
        );

        this.steamDisk = new ValheimDisk(
            "valheim-steam",
            props.steamVolumeFactory,
            {parent: this},
        );

        if (props.backupVolumeFactory !== undefined) {
            this.backupDisk = new ValheimDisk(
                "valheim-backup",
                props.backupVolumeFactory,
                {parent: this},
            );
        }

        const labels = {
            "app.kubernetes.io/name": "valheim",
        };

        const odinHttpPort = 8000;
        const gameUdpPorts = [2456, 2457, 2458];

        const serviceAnnotations = {
            // The StatefulSet scales down to 0 replicas, this is the
            // documented workaround:
            // https://www.pulumi.com/docs/reference/pkg/kubernetes/core/v1/service/
            // https://github.com/pulumi/pulumi-kubernetes/pull/703
            "pulumi.com/skipAwait": "true",
        };

        this.gameService = new k8s.core.v1.Service(
            "valheim-game",
            {
                metadata: {
                    labels,
                    annotations: serviceAnnotations,
                },
                spec: {
                    selector: labels,
                    type: "LoadBalancer",
                    loadBalancerIP: props.ip,
                    ports: gameUdpPorts.map((port, index) => {
                        return {
                            port,
                            protocol: "UDP",
                            name: `port${index}`,
                        };
                    }),
                },
            },
            {parent: this},
        );

        this.odinService = new k8s.core.v1.Service(
            "valheim-odin",
            {
                metadata: {
                    labels,
                    annotations: serviceAnnotations,
                },
                spec: {
                    selector: labels,
                    type: "ClusterIP",
                    ports: [
                        {
                            port: odinHttpPort,
                            protocol: "TCP",
                        },
                    ],
                },
            },
            {parent: this},
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
                metadata: {
                    labels,
                },
                stringData: secretStringData,
            },
            {
                parent: this,
            },
        );

        const persistence: Array<{
            name: string;
            mountPath: string;
            disk: ValheimDisk;
        }> = [
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
        ];

        if (this.backupDisk !== undefined) {
            persistence.push({
                name: "backup",
                mountPath: "/home/steam/backups",
                disk: this.backupDisk,
            });
        }

        const enableBackups = this.backupDisk !== undefined ? "1" : "0";

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
                value: enableBackups,
            },
            {
                name: "AUTO_BACKUP_ON_UPDATE",
                value: enableBackups,
            },
            {
                name: "AUTO_BACKUP_ON_SHUTDOWN",
                value: enableBackups,
            },
            {
                name: "HTTP_PORT",
                value: `${odinHttpPort}`,
            },
        ];

        this.statefulSet = new k8s.apps.v1.StatefulSet(
            "valheim",
            {
                metadata: {
                    labels,
                },
                spec: {
                    serviceName: this.gameService.metadata.name,
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
                                    ports: [
                                        {
                                            containerPort: odinHttpPort,
                                            protocol: "TCP",
                                        },
                                        ...gameUdpPorts.map((port) => {
                                            return {
                                                containerPort: port,
                                                protocol: "UDP",
                                            };
                                        }),
                                    ],
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
