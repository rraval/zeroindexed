# @zeroindexed/toph-worker

Privacy preserving website analytics. Features:

-   Cookie-less tracking with heuristic based unique visitor identity, see [implementation][this-implementation].
-   Free, up to [very generous limits][cloudflare-workers-free-tier].
-   [Zero configuration single HTML tag setup][this-usage] that supports page views from multiple domains.
-   Fast, zero byte payload delivered by Cloudflare edge servers.
-   Backed by Google Universal Analytics, leveraging all the UI and reporting goodness without leaking visitor information.

## Usage

Assuming that the Cloudflare worker is deployed to https://toph.zeroindexed.com, you can simply drop the following HTML into the `<head>` element of any page:

```html
<script
    async
    referrerpolicy="no-referrer-when-downgrade"
    src="https://toph.zeroindexed.com/pageview"
></script>
```

The [`async` attribute][script-async] minimizes the performance cost by permitting the browser to continue parsing and presenting the page without waiting for analytics overhead.

The explicit [`referrerpolicy` attribute][script-referrerpolicy] directs the browser to send the [`Referer` header][http-referer] when fetching the analytics resource. This is how Toph knows what page is being viewed, but see the [API][this-api] for avoiding the `Referer` header and making things explicit. You may wish to use a different `referrerpolicy` depending on your threat model and HTTPS setup.

The `src` attribute tells the the browser to fetch the [`/pageview` API][this-api], which invokes the Toph Cloudflare worker, which then makes a network request to Google Analytics.

### API

Toph supports a single endpoint, `/pageview`, which sends a [`t=pageview` hit][ga-pageview] to Google Universal Analytics.

`/pageview` does not care what HTTP method it was invoked with, `GET`, `POST`, `PUT`, etc. are all supported.

`/pageview` supports optional parameters passed as query parameters in the URL:

-   `?url=<percent-encoded-url>`: By default, the [document location URL][ga-document-location] is derived from the [HTTP `Referer` header][http-referer], which requires cooperation from the browser and can be unreliable. Passing the `url` parameter provides an explicit document location URL which overrides any `Referer` that was passed in. For example:

```console
# `url` must be absolute and percent encoded
$ curl https://toph.zeroindexed.com/pageview?url=https%3A%2F%2Fzeroindexed.com
```

-   `?expiration=<number>`: Number of seconds to expire the visitor session after. Overrides the `DEFAULT_SESSION_EXPIRATION_SECONDS`.
-   `?extension=<number>`: Number of seconds to extend the visitor session after. Overrides the `DEFAULT_SESSION_EXTENSION_SECONDS`.

The `expiration` and `extension` parameters influence how [unique visitors are counted][this-unique-counting]. They can be overridden on a per page basis:

```console
# An expiration of 2 hours and an extension every 20 minutes
$ curl https://toph.zeroindexed.com/pageview?expiration=7200&extension=1200
```

## Deployment

The related package [`@zeroindexed/toph-pulumi`][toph-pulumi] is a [Pulumi][pulumi] package that makes deployment trivial. Use it if you can.

FIXME(#7): document how to deploy without Pulumi.

## Implementation

Toph is an HTTP service deployed as a Cloudflare worker that acts as a privacy preserving proxy between the visitor's browser and Google Analytics.

The analytics event is collected only over HTTP, which nullifies [many modern fingerprinting techniques that rely on JavaScript][device-fingerprinting].

Google Analytics only sees a connection from Cloudflare servers, so Google never sees a visitor's IP address or `User-Agent`. Toph has access to this information but chooses not to forward it. However, Cloudflare will pick edge servers close to the visitor's geographic location and Google will see an IP address originating from Cloudflare data centers. This has the side effect of making Google Analytics geographic reports somewhat useful, but depending on your point of view, this can also be considered a minor information leak.

### Counting unique visitors

Toph uses persistence backed by [Cloudflare workers KV][cloudflare-workers-kv] to implement a [time based heuristic scheme for identifying clients][src-clientid].

A "session" is uniquely identified by the SHA256 hash of the visitor IP address and `User-Agent`. The first time a hash is encountered, a [UUID v4][uuidv4] is generated for use as the [Google Analytics client ID][ga-client-id]. This UUID is uncorelated to the hash, so multiple separate sessions with the same IP address and `User-Agent` would still get different client IDs from Google's perspective.

A session is automatically ended after a "session expiration duration", which is `DEFAULT_SESSION_EXPIRATION_SECONDS` unless overriden by the `?expiration=<number>` parameter. If the user persists in sending `/pageview` events after a "session extension duration" (defaults to `DEFAULT_SESSION_EXTENSION_SECONDS` but can be overriden by `?extension=<number>`), the session is extended and reset for another "session expiration duration".

Due to the possible timings, the nature of caching, and eventually consistent writes, the actual session duration is approximately between `expiration - extension` and `expiration + extension` seconds. Adjust timing thresholds to your use case.

This sort of cookie-less tracking has prior art, [Plausible uses a similar scheme][plausible-unique-visitors]. However, they seem to use a complicated daily rotating salt for some reason, Toph merely expires the SHA256-to-UUID mapping as a means of anonymization.

Plausible's testing indicates that such a scheme is likely okay for approximate unique visitor counts for a variety of websites:

> In our testing, using IP addresses to count visitors is remarkably accurate when compared to using a cookie. Total unique visitor counts were within 10% error range with IP-based counting usually showing lower numbers.
>
> — https://plausible.io/blog/google-analytics-cookies#but-what-if-the-ip-address-of-a-visitor-gets-changed

## Why Universal Analytics?

These days, Google Analytics is strongly pushing for Google Analytics 4 usage. Toph uses the older Universal Analytics, which requires jumping through [some "advanced options" hoops when setting up a new property][ga-new-ua].

The [measurement protocol for Google Analytics 4 comes with a big disclaimer][ga4-measurement-protocol]:

> **Warning**: This is an alpha API and subject to change. You may encounter breaking changes while it is in alpha. Code using this API should not be pushed to production. See limitations for issues that will be address before a general availability launch.

So Toph opts for the established Universal Analytics protocol instead, with the narrower use case of website analytics.

## Why not...?

Toph is a new player in the already well established website analytics space. There are tons of existing solutions, what's the justification for another one to exist?

For starters, Toph isn't actually a fully fledged website analytics solution. It merely piggybacks off the hard work of Google Analytics while presenting a privacy preserving in-between layer. This isn't novel, Cloudflare themselves [provide something similar as an example use case for Cloudflare workers][cloudflare-workers-analytics] and a simple Google search [turns up at least one other alternative][samkelleher-worker-analytics].

Instead, Toph's value proposition derives from the combination of:

-   Free, especially in the use case of blog analytics for https://zeroindexed.com.
-   Minimal setup with HTTP `Referer` based tracking.
-   Minimal performance overhead.
-   Privacy preserving for visitors.

All the established players ended up failing some of these criteria:

-   Google Analytics is definitely not privacy preserving.
-   Self hosting Matamo requires a server that is continously online, which is not free.
-   Plausible is unabashedly at least $6/month (good for them, good products should have a chance to make money; they're just not a good fit for my low traffic blog).
-   Cloudflare analytics is arguably closest to what Toph offers, but only available on the Pro tier which is $20/month.

## Cost Analysis

Toph makes extensive use of the [Cloudflare workers free tier][cloudflare-workers-free-tier] to minimize costs. However it does issue a write per unique visitor as well as for session extension, so it is possible to run into the limits of 1000 writes per day.

If your website if popular, this writes per day limit is likely going to be the limiting factor. Your options are:

-   Deal with the fact that you'll miss analytics events during these bouts of popularity.
-   Pay the $5/month fixed cost (and whatever variable cost) to upgrade to the workers paid plan with at least 1 million writes per month. This cost can be amortized across other projects that also utilize Cloudflare workers as their deployment mechanism (**cough** [like a controller UI for valheim][valheimctl-worker] **cough**).

[cloudflare-workers-analytics]: https://github.com/cloudflare/workers-google-analytics
[cloudflare-workers-free-tier]: https://developers.cloudflare.com/workers/platform/limits#worker-limits
[cloudflare-workers-kv]: https://developers.cloudflare.com/workers/learning/how-kv-works
[device-fingerprinting]: https://en.wikipedia.org/wiki/Device_fingerprint
[ga-client-id]: https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#cid
[ga-document-location]: https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#dl
[ga-new-ua]: https://support.google.com/analytics/answer/10269537?hl=en
[ga-pageview]: https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#t
[ga4-measurement-protocol]: https://developers.google.com/analytics/devguides/collection/protocol/ga4
[http-referer]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referer
[plausible-unique-visitors]: https://plausible.io/data-policy#how-we-count-unique-users-without-cookies
[samkelleher-worker-analytics]: https://github.com/samkelleher/cloudflare-worker-google-analytics
[script-async]: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script#attr-async
[script-referrerpolicy]: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script#attr-referrerpolicy
[src-clientid]: src/client-id.ts
[this-api]: #api
[this-deployment]: #deployment
[this-implementation]: #implementation
[this-unique-counting]: #counting-unique-visitors
[this-usage]: #usage
[toph-pulumi]: ../toph-pulumi
[uuidv4]: https://en.wikipedia.org/wiki/Universally_unique_identifier#Version_4_(random)
[valheimctl-worker]: ../valheimctl-worker
