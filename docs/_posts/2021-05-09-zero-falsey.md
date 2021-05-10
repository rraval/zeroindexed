---
permalink: /zero-falsey
title: Zero is fundamentally supposed to be falsey
---

- [ ] Here's some observational humour: the [Church encoding of the boolean literal][church-boolean] `false` is defined as `λa. λb. b`. The [Church encoding of the numeric literal][church-number] `0` is defined as `λf. λx. x`. If you squint, you'll see that they have same structure (given)

[church-boolean]: https://en.wikipedia.org/wiki/Church_encoding#Church_Booleans
[church-number]: https://en.wikipedia.org/wiki/Church_encoding#Church_numerals