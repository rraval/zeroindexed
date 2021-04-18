# @zeroindexed/webpacker

Compiles a package to a string with webpack.

## Motivation

Allows source code for Cloudflare workers to be developed as a normal JS package. This package can be compiled to a single string artifact and deployed via Pulumi.

## Usage

```ts
import {webpacker} from "@zeroindexed/webpacker";

const content = webpacker({
    // Can be any package pulled in as a dependency
    package: "@zeroindexed/valheimctl-worker",
    // The package itself must support compilation via webpack.
    // This path is relative to the `main` specified inside the package's
    // `package.json`.
    webpackConfigPath: "../webpack.wrangler.js",
});
```
