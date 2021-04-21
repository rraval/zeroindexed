# @zeroindexed/cloudflare-github-pages

Pulumi package for custom domains on GitHub Pages via Cloudflare DNS.

## Usage: Apex Domain

If you'd like GitHub pages to use the main ("apex") domain name:

```ts
import {CloudflareGithubPages} from "@zeroindexed/cloudflare-github-pages";

CloudflareGithubPages.apex("githubPages", {
    // Find this in the Cloudflare dashboard for your domain
    zoneId: "eb5986a524b6f74d162110cd89f815e1",

    // Optional, sets up `www.zeroindexed.com` to redirect to `zeroindexed.com`.
    // In theory, this could be inferred from the `zoneId`, but that would have
    // to query Cloudflare on each `pulumi up`, and that seems inefficient.
    zone: "zeroindexed.com",
});
```

## Usage: Subdomain

If instead, you'd like to use a subdomain like `blog.zeroindexed.com`:

```ts
import {CloudflareGithubPages} from "@zeroindexed/cloudflare-github-pages";

CloudflareGithubPages.subdomain("githubPages", {
    // Find this in the Cloudflare dashboard for your domain
    zoneId: "eb5986a524b6f74d162110cd89f815e1",

    // Only need the subdomain part, the `zeroindexed.com` gets inferred from
    // the `zoneId`.
    subdomain: "blog",
});
```
