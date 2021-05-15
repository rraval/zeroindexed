import {Toph} from "@zeroindexed/toph-pulumi";

import type {Config} from "./config";

export function makeToph(config: Config): void {
    new Toph("toph", {
        cloudflareZone: config.cloudflare.zone,
        cloudflareZoneId: config.cloudflare.zoneId,
        subdomain: "toph",
        trackingId: config.toph.trackingId,
        defaultSessionDurationSeconds: 60 * 60 * 2, // 2 hours
    });
}
