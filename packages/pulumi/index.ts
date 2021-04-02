import * as cloudflare from "@pulumi/cloudflare";
import * as gcp from "@pulumi/gcp";
import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
import {ValheimServer, ValheimPersistentVolumeFactory} from "@zeroindexed/valheim";

const gcpConfig = new pulumi.Config("gcp");
const config = new pulumi.Config();

const shouldImport = config.requireBoolean("shouldImport");
const clusterName = config.require("clusterName");
const cloudflareZoneId = config.require("cloudflareZoneId");

// config.requireObject doesn't actually validate types, so write things out
// explicitly
const valheimIsRunning = config.requireBoolean("valheimIsRunning");
const valheimCpu = config.require("valheimCpu");
const valheimMemory = config.require("valheimMemory");
const valheimTimeZone = config.require("valheimTimeZone");
const valheimServerName = config.require("valheimServerName");
const valheimWorldName = config.require("valheimWorldName");
const valheimPassword = config.requireSecret("valheimPassword");
const valheimWebhookUrl = config.getSecret("valheimWebhookUrl");

// We manually created disks and the cluster outside of Pulumi.
//
// Always protect those resources to prevent automatic deletion. Set things up
// for a one time import.
function optionallyImport(importName: string): pulumi.CustomResourceOptions {
    const opts: pulumi.CustomResourceOptions = {protect: true};
    if (shouldImport) {
        opts.import = importName;
    }
    return opts;
}

const cluster = new gcp.container.Cluster(
    clusterName,
    {
        enableBinaryAuthorization: false,
        enableIntranodeVisibility: true,
        enableKubernetesAlpha: false,
        enableLegacyAbac: false,
        enableShieldedNodes: true,
        enableTpu: false,
        name: clusterName,
        network: "default",
        verticalPodAutoscaling: {
            enabled: true,
        },
        workloadIdentityConfig: {
            identityNamespace: `${gcpConfig.require("project")}.svc.id.goog`,
        },
    },
    optionallyImport(`${gcp.config.region}/${clusterName}`),
);

// Create a Kubernetes provider instance that uses our cluster from above.
const clusterProvider = new k8s.Provider(clusterName, {
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

const valheimIp = new gcp.compute.Address("valheim-ip");

function makeVolumeFactory(name: string): ValheimPersistentVolumeFactory {
    const gcpDisk = new gcp.compute.Disk(
        name,
        {
            interface: "SCSI",
            name,
            type: "pd-balanced",
            size: 10, // GB
        },
        optionallyImport(name),
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
            opts,
        );
    };
}

const _valheim = new ValheimServer(
    "valheim",
    {
        configVolumeFactory: makeVolumeFactory("valheim-pd0"),
        steamVolumeFactory: makeVolumeFactory("valheim-pd1"),
        backupVolumeFactory: makeVolumeFactory("valheim-pd2"),
        ip: valheimIp.address,
        isRunning: valheimIsRunning,
        cpu: valheimCpu,
        memory: valheimMemory,
        timeZone: valheimTimeZone,
        serverName: valheimServerName,
        worldName: valheimWorldName,
        password: valheimPassword,
        webhookUrl: valheimWebhookUrl,
    },
    {
        provider: clusterProvider,
    },
);

const _valheimDnsRecord = new cloudflare.Record("valheim", {
    zoneId: cloudflareZoneId,
    name: "valheim",
    value: valheimIp.address,
    type: "A",
});
