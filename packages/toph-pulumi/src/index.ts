import fs from "fs";

import * as cloudflare from "@pulumi/cloudflare";
import * as pulumi from "@pulumi/pulumi";

const WORKER_SCRIPT = fs.promises.readFile(
    require.resolve("@zeroindexed/toph-worker"),
    {encoding: "utf8"},
);

export interface TophArgs {
    cloudflareZoneId: pulumi.Input<string>;
    cloudflareZone: pulumi.Input<string>;
    subdomain: pulumi.Input<string>;
    trackingId: pulumi.Input<string>;
    defaultSessionDurationSeconds: pulumi.Input<number>;
}

export class Toph extends pulumi.ComponentResource {
    public constructor(
        name: string,
        args: TophArgs,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super("zeroindexed:toph-pulumi", name, args, opts);

        const kv = new cloudflare.WorkersKvNamespace(
            "toph-kv",
            {title: pulumi.concat(args.subdomain, "-kv")},
            {parent: this},
        );

        const workerScript = new cloudflare.WorkerScript(
            "toph",
            {
                name: pulumi.concat(args.subdomain, "-worker"),
                content: WORKER_SCRIPT,
                plainTextBindings: [{
                    name: "TRACKING_ID",
                    text: args.trackingId,
                }, {
                    name: "DEFAULT_SESSION_DURATION_SECONDS",
                    text: `${args.defaultSessionDurationSeconds}`,
                }],
                kvNamespaceBindings: [{
                    name: "KV",
                    namespaceId: kv.id,
                }],
            },
            {parent: this},
        );

        new cloudflare.WorkerRoute(
            "toph",
            {
                zoneId: args.cloudflareZoneId,
                pattern: pulumi.concat("https://", args.subdomain, ".", args.cloudflareZone, "/*"),
                scriptName: workerScript.name,
            },
            {parent: this},
        );

        new cloudflare.Record(
            "toph",
            {
                zoneId: args.cloudflareZoneId,
                name: args.subdomain,
                type: "AAAA",
                value: "100::",
                proxied: true,
            },
            {parent: this},
        );
    }
}
