---
permalink: /analytics
title: This blog has analytics and a privacy policy now
---

Even though the Jekyll Minima theme has [off the shelf support for Google Analytics][minima-ga], I decided to be a good internet denizen and use something that preserved visitor privacy.

I thought that surely in 2021, somebody would have built a simple page view counter that I could just plug into my dinky blog for minimal cost. I ended up evaluating all the popular alternatives: [Matamo][matamo], [Plausible][plausible], and [Cloudflare analytics][cloudflare-analytics].

As it turns out, all of these are rather expensive. What should have been simple became bespoke and [Toph was born][toph]. It's a Cloudflare workers service that sits in between the visitors browser and Google Analytics.

<!--more-->

Toph is a first party analytics solution, which is generally regarded favourably compared to the third party tracker status quo. It would have been completely okay to do visitor identity tracking by shoving a UUID into a cookie. This usage would likely [not even require explicit consent][first-party-cookie-consent].

But for entirely dubious motivations, I decided to make the implementation cookie-less, trading accuracy and retention metrics for an even smaller privacy footprint. The end result works somewhat like [Plausible's cookie-less tracking][plausible-cookie-less], but the [Toph implementation is interesting in its own right][toph-implementation].

I think if you asked me "how much do you care about web privacy?", I would have given an apathetic response. But clearly I care enough to spend many hours [building a reusable self deployable solution][npm-toph-worker] and even [packaging it up with Pulumi to make deployment trivial][npm-toph-pulumi]. I'm not sure what virtues this signals.

Oh, and it's called Toph because [it is blind to the visitor's personal information][toph-beifong].

# Changelog

2021-05-30: Added this changelog.

2021-05-16: Published.

[cloudflare-analytics]: https://www.cloudflare.com/analytics/
[matamo]: https://matomo.org/
[minima-ga]: https://github.com/jekyll/minima/blob/2.5-stable/_includes/google-analytics.html
[plausible]: https://plausible.io/
[plausible-cookie-less]: https://plausible.io/data-policy#how-we-count-unique-users-without-cookies
[toph]: https://github.com/rraval/zeroindexed/tree/master/packages/toph-worker#readme
[first-party-cookie-consent]: https://law.stackexchange.com/a/29291
[toph-implementation]: https://github.com/rraval/zeroindexed/tree/master/packages/toph-worker#implementation
[npm-toph-worker]: https://www.npmjs.com/package/@zeroindexed/toph-worker
[npm-toph-pulumi]: https://www.npmjs.com/package/@zeroindexed/toph-pulumi
[toph-beifong]: https://avatar.fandom.com/wiki/Toph_Beifong
