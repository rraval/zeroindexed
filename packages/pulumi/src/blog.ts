import {CloudflareGithubPages} from "@zeroindexed/cloudflare-github-pages";

import type {Config} from "./config";

export function makeBlog(config: Config): void {
    CloudflareGithubPages.apex("blog", {
        zoneId: config.cloudflare.zoneId,
        zone: config.cloudflare.zone,
    });
}
