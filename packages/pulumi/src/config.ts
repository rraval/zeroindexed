import * as pulumi from "@pulumi/pulumi";

export interface Config {
    kubernetes: {
        clusterName: string;
    };
    cloudflare: {
        zone: string;
        zoneId: string;
    };
    valheim: {
        cpu: string;
        memory: string;
        timeZone: string;
        serverName: string;
        worldName: string;
        password: pulumi.Output<string>;
        webhookUrl: pulumi.Output<string> | undefined;
    };
    toph: {
        trackingId: string;
    };
}

// config.requireObject doesn't actually validate types, so write things out
// explicitly
export const Config = {
    fromPulumi(): Config {
        const config = new pulumi.Config();

        return {
            kubernetes: {
                clusterName: config.require("clusterName"),
            },
            cloudflare: {
                zone: config.require("cloudflareZone"),
                zoneId: config.require("cloudflareZoneId"),
            },
            valheim: {
                cpu: config.require("valheimCpu"),
                memory: config.require("valheimMemory"),
                timeZone: config.require("valheimTimeZone"),
                serverName: config.require("valheimServerName"),
                worldName: config.require("valheimWorldName"),
                password: config.requireSecret("valheimPassword"),
                webhookUrl: config.getSecret("valheimWebhookUrl"),
            },
            toph: {
                trackingId: config.require("tophTrackingId"),
            },
        };
    },
};
