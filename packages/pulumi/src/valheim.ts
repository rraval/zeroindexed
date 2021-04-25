import * as cloudflare from "@pulumi/cloudflare";
import * as gcp from "@pulumi/gcp";
import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
import {ValheimServer, ValheimPersistentVolumeFactory} from "@zeroindexed/valheim";
import {ValheimCtl} from "@zeroindexed/valheimctl";

import type {Config} from "./config";

function makeVolumeFactory(name: string): ValheimPersistentVolumeFactory {
    const gcpDisk = new gcp.compute.Disk(
        name,
        {
            interface: "SCSI",
            name,
            type: "pd-balanced",
            size: 10, // GB
        },
        {protect: true},
    );

    return (name, opts) => {
        const storage = pulumi.concat(gcpDisk.size, "G");

        return new k8s.core.v1.PersistentVolume(
            name,
            {
                spec: {
                    capacity: {
                        storage,
                    },
                    accessModes: ["ReadWriteOnce"],
                    persistentVolumeReclaimPolicy: "Retain",
                    gcePersistentDisk: {
                        pdName: gcpDisk.name,
                        fsType: "ext4",
                    },
                    storageClassName: "standard-rwo",
                },
            },
            {
                ...opts,
                deleteBeforeReplace: true,
            },
        );
    };
}

export function makeValheim({
    config,
    cluster,
    provider,
}: {
    config: Config;
    cluster: gcp.container.Cluster;
    provider: k8s.Provider;
}): void {
    const valheimIp = new gcp.compute.Address("valheim-ip");

    const valheim = new ValheimServer(
        "valheim",
        {
            configVolumeFactory: makeVolumeFactory("valheim-pd0"),
            steamVolumeFactory: makeVolumeFactory("valheim-pd1"),
            backupVolumeFactory: makeVolumeFactory("valheim-pd2"),
            ip: valheimIp.address,
            cpu: config.valheim.cpu,
            memory: config.valheim.memory,
            timeZone: config.valheim.timeZone,
            serverName: config.valheim.serverName,
            worldName: config.valheim.worldName,
            password: config.valheim.password,
            webhookUrl: config.valheim.webhookUrl,
        },
        {provider},
    );

    new cloudflare.Record("valheim", {
        zoneId: config.cloudflare.zoneId,
        name: "valheim",
        value: valheimIp.address,
        type: "A",
    });

    new ValheimCtl(
        "valheim-ctl",
        {
            server: valheim,
            cloudflareZone: config.cloudflare.zone,
            cloudflareZoneId: config.cloudflare.zoneId,
            clusterEndpointIp: cluster.endpoint,
            password: config.valheim.password,
            actorLogTtl: 60 * 60 * 24, // 24 hours
            idleShutdown: {
                schedule: "*/5 * * * *", // check every 5 minutes
                after: 60 * 10, // shut down after 10 minutes idle
                logTtl: 60 * 60, // 1 hour
            },
        },
        {provider},
    );
}
