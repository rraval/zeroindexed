# @zeroindexed/toph-pulumi

A [Pulumi][pulumi] package for deploying [`@zeroindexed/toph-worker`][toph-worker] as a Cloudflare worker under your account.

## Usage

Configure [Pulumi to work with the Cloudflare provider][pulumi-cloudflare].

This example configures Toph to run under https://toph.zeroindexed.com, adjust accordingly (see [the actual code][toph-deployment]).

```ts
// Use `npm install` or `yarn add` to import the package
import {Toph} from "@zeroindexed/toph-pulumi";

new Toph("toph", {
    // The Apex domain to deploy under
    cloudflareZone: "zeroindexed.com",

    // The Cloudflare Zone ID for the domain, visible on the dashboard
    cloudflareZoneId: "eb5986a524b6f74d162110cd89f815e1",

    // The subdomain to deploy under
    subdomain: "toph",

    // The Google Universal Analytics tracking ID to use
    trackingId: "UA-197056272-1",

    // These timeouts tune how long a visitor session lasts of my blog. Adjust
    // to your usecase and see the `toph-worker` documentation.
    defaultSessionExpirationSeconds: 60 * 60 * 2, // 2 hours
    defaultSessionExtensionSeconds: 60 * 20, // 20 minutes
});
```

[pulumi]: https://www.pulumi.com/
[pulumi-cloudflare]: https://www.pulumi.com/docs/intro/cloud-providers/cloudflare/setup/
[toph-worker]: ../toph-worker
[toph-deployment]: ../pulumi/src/toph.ts
