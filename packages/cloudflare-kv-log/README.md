# @zeroindexed/cloudflare-kv-log

Minimal logging for [Cloudflare workers][workers] backed by [Cloudflare workers KV][kv].

Given the [architecture of workers KV][kv-arch], this package only makes sense for the narrow set of usecases where write volume is low and no correctness properties depend on the logging (writes are eventually consistent with no guaranteed upper bound).

Reading the logs makes use of [listing keys][kv-list], which has a [rather low per day limit on the Cloudflare free tier][kv-limits].

To summarize these caveats: strongly consider if Cloudflare workers KV is the right persistence medium for what you're trying to do.

## Usage

```ts
import {Logger, Persistence} from "@zeroindexed/cloudflare-kv-log";

// create a logger
const logger = new Logger({
    // Some `KVNamespace` from your worker bindings
    kv: ...,
    // The logger only uses keys with this prefix. This allows sharing the
    // `KVNamespace` with other things, including other loggers with
    // different prefixes.
    prefix: "Log:",
    // Logs automatically expire after a given number of seconds.
    // 10 minutes in this example.
    ttl: 60 * 10,
});

// log a message with the current timestamp
logger.log("some message");

// log a message with an explicit timestamp
logger.push({instant: Date.now(), message: "some message"});

// query ordered log entries
logger.oldest();  // chronological
logger.newest();  // reverse chronological
```

[workers]: https://developers.cloudflare.com/workers/
[kv]: https://developers.cloudflare.com/workers/runtime-apis/kv
[kv-arch]: https://developers.cloudflare.com/workers/learning/how-kv-works
[kv-list]: https://developers.cloudflare.com/workers/runtime-apis/kv#listing-keys
[kv-limits]: https://developers.cloudflare.com/workers/platform/pricing#kv
