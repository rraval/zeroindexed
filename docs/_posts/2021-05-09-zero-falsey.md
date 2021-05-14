---
permalink: /zero-falsey
title: Zero is fundamentally supposed to be falsey
---

Here's some observational humour: the [Church encoding of the boolean literal][church-boolean] `false` is defined as `λa. λb. b`. The [Church encoding of the numeric literal][church-number] `0` is defined as `λf. λx. x`. If you squint, you'll see that they have same structure — something computer science people have decided to give the impenetrable name of [α-equivalence][alpha-equivalence]. This means that programming languages without implicit number-to-boolean conversions are missing out of this fundamental property of the universe.

I write this blog post for two reasons:

1. I think more people should be aware of this genuinely funny equivalence which arises out of sheer happenstance.
2. To examine all of the absurdity that makes this funny, likely killing the joke in the process.

<!--more-->

# It's a pun

Chapter 5 of Benjamin Pierce's Types and Programming Languages:

> (The reader may already have observed that `c0` and `fls` are actually the same term. Similar "puns" are common in assembly languages, where the same pattern of bits may represent many different values—an int, a float, an address, four characters, etc.—depending on how it is interpreted, and in low-level languages such as C, which also identifies `0` and `false`.)

# Implicit conversions are not great

# Lambda calculus is not fundamental

# Church encoding is not fundamental

Next up in this series: what *is* the deal with airplane food?

[church-boolean]: https://en.wikipedia.org/wiki/Church_encoding#Church_Booleans
[church-number]: https://en.wikipedia.org/wiki/Church_encoding#Church_numerals\
[alpha-equivalence]: https://wiki.c2.com/?AlphaEquivalence