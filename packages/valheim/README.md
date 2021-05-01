# @zeroindexed/valheim

Pulumi component to run [Valheim][valheim] in any Kubernetes environment.

Builds upon the excellent [mbround18/valheim-docker][valheim-docker] image:

-   Game ports on the default UDP ports (2456, 2457, and 2458) are exposed to the external world. This allows the game to connect directly to the server via IP address or domain name.
-   The [Odin][odin] HTTP service allows querying game server status, but is only accessible inside the cluster.

## Related work

-   [`@zeroindexed/valheimctl-worker`][valheimctl-worker]: a web UI to control your Valheim server and automatically turn it off when it is idle.
-   [`@zeroindexed/valheimctl`][valheimctl]: a Pulumi package to deploy `@zeroindexed/valheimctl-worker`.
-   [Real world usage][usage] of this package to host the `valheim.zeroindexed.com` server.

## Usage

This package intends to be cloud independent, and so relies on you to pass in a `ValheimPersistentVolumeFactory`, which is just a function that creates Kubernetes `PersistentVolume` configured the way you want it.

This example uses Google Cloud and explicitly allocates a [`gcp.compute.Disk`][gcp-disk] and binds it to a `PersistentVolume` via the [`gcePersistentDisk` configuration][gcp-pv]. You don't have to do things this way, you can use [dynamically provisioned volumes][gcp-dynamic-pv] or any other cloud provider configuration that Kubernetes supports.

```ts
import * as gcp from "@pulumi/gcp";
import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import {ValheimServer, ValheimPersistentVolumeFactory} from "@zeroindexed/valheim";

const configVolumeFactory: ValheimPersistentVolumeFactory = (name, opts) => {
    const gcpDisk = new gcp.compute.Disk(
        "valheim-config-pd",
        {
            interface: "SCSI",
            name: "valheim-config-pd", // the name for the disk in Google Cloud
            type: "pd-balanced",
            size: 10, // GB
        },
        {protect: true}, // Recommended so pulumi doesn't delete data
    );

    // Could also hardcode the `10G` size here, but why repeat yourself
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
            // Override the Pulumi default of creating a replacement first,
            // since multiple claims on the underlying disk will not work
            deleteBeforeReplace: true,
        },
    );
};
```

With the storage figured out, this package is easy enough to use:

```ts
import * as gcp from "@pulumi/gcp";
import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

// Whatever existing Kubernetes provider you are using in Pulumi
const provider: k8s.Provider = ...;

const valheim = new ValheimServer(
    "valheim",
    {
        // The volume factories discussed above.

        // Holds world and server specific data.
        // VERY IMPORTANT, DO NOT MISPLACE.
        //
        // 2G is probably good enough.
        configVolumeFactory: ...,

        // Holds game executables and data from Steam. This data isn't valuable
        // and can always be redownloaded from an empty disk.
        //
        // 10G is probably good enough.
        steamVolumeFactory: ...,

        // Optional but highly recommended. Makes periodic backups of the world
        // and saves it to this disk (timing is whatever default
        // `mbround18/valheim-docker` ships with).
        //
        // 10G is probably good enough.
        backupVolumeFactory: ...,

        // IP address for the Kubernetes `LoadBalancer` that directs traffic to
        // the game server.
        ip: "...",

        // Kubernetes resources to allocate to the game.
        //
        // https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/#meaning-of-cpu
        // https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/#meaning-of-memory
        //
        // These values seem to work well enough in practice. See also
        // https://www.reddit.com/r/valheim/comments/lcg8xk/dedicated_server_requirements/
        cpu: "4",
        memory: "4Gi",

        // Time zone for the server and `serverName` allegedly shows up in the
        // in game server browser.
        timeZone: "America/Toronto",
        serverName: "MyAwesomeServer",

        // Somewhat important, drives the file names used for the world hosted
        // by the server.
        //
        // This example will use `worlds/World.db` and `worlds/World.fwl` on the
        // volume from `configVolumeFactory`.
        //
        // Modify this appropriately if you're importing game files from an
        // existing world.
        worldName: "World",

        // Optional, in-game server password to prevent randoms from joining.
        password: config.valheim.password,

        // Optional, announce server status to Discord.
        //
        // https://github.com/mbround18/valheim-docker/blob/main/docs/webhooks.md
        //
        // Also see `@zeroindexed/valheimctl` for a web UI that essentially does
        // the same thing.
        webhookUrl: config.valheim.webhookUrl,
    },
    {provider},
);
```

[valheim]: https://www.valheimgame.com/
[valheim-docker]: https://github.com/mbround18/valheim-docker
[valheimctl-worker]: ../valheimctl-worker
[valheimctl]: ../valheimctl
[odin]: https://github.com/mbround18/valheim-docker/blob/main/docs/releases/status_update.md#-http-server-for-serving-status
[gcp-disk]: https://www.pulumi.com/docs/reference/pkg/gcp/compute/disk/
[gcp-pv]: https://kubernetes.io/docs/concepts/storage/volumes/#gcepersistentdisk
[gcp-dynamic-pv]: https://cloud.google.com/kubernetes-engine/docs/concepts/persistent-volumes
[usage]: ../pulumi/src/valheim.ts
