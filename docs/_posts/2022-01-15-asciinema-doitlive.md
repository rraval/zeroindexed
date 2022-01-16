---
permalink: /asciinema-doitlive
title: Effective terminal presentations with asciinema and doitlive
---

I've been trying to push my personal boundaries of "doing open source right". [On the most recent pet project][git-nomad], that means putting those little README shields that people seem so fond of; leveraging GitHub actions for automated testing, linting, and deploying; and recording a screencast to give an interactive tour of functionality.

[asciinema][] is a popular utility for distributing screencasts but the interactive recording style resulted in a final product with quite a few flaws. I wrote a script, built [a few helpers](https://github.com/rraval/git-nomad/commit/2874bad7e8d810a5ab06370a6fcceae3ad384770#diff-206b9ce276ab5971a2489d75eb1b12999d4bf3843b7988cbe8d687cfde61dea0), and recorded segments in multiple takes until arriving at something passable. And "passable" just about summarizes the end result, there's still the occasional typo, the cuts are jarring, and the typing has awkward pauses even with `--idle-time-limit=0.3`. Worst of all, it's ~5 minutes long, which I'd reckon is enough to frustrate even the most motivated viewer.

<!--more-->

[![git-nomad 0.4.0 asciicast](https://asciinema.org/a/458630.svg)](https://asciinema.org/a/458630?autoplay=1)

In hopes of doing better, I found a [HackerTyper][hackertyper]-like tool called [doitlive][] meant for live presentations in the terminal. Using it with asciinema is straight forward (based on [this gist by Thomas Applencourt][gist]):

```
asciinema rec --command 'doitlive play --commentecho --quiet --shell bash <script.sh>' <recording.cast>
```

This runs the `asciinema` recorder on the outside and typing controls the pace at which `doitlive` reads the commands from the provided `<script.sh>`.

Overall the experience is quite pleasant: you write the script and simply whack the keyboard as fast as you please to control the pacing. It also trivializes making future recordings as the behaviour of the underlying demo changes. It's not quite a non-linear video editor, but it'll do.

`doitlive` has features to inject environment variables and display commentary, however the nature of [maintaining independent shell state](https://github.com/sloria/doitlive/blob/357d086d93c567a3e107efad496e33d1ee90470a/doitlive/cli.py#L51) and [interpreting commands](https://github.com/sloria/doitlive/blob/357d086d93c567a3e107efad496e33d1ee90470a/doitlive/keyboard.py#L91) mean that [recording helpers that export variables and change directories cannot be used](https://github.com/rraval/git-nomad/commit/2874bad7e8d810a5ab06370a6fcceae3ad384770#diff-ba249f54c3ae36c2b54dc5ff6c09c440a01e2caaeb4e7e3f17fec5f2ef37af88). There's also no affordance to execute hidden commands, though that's understandable the motivation of a presentation tool.

Here's the final result, equivalent to the previous one at just 93 seconds. It could be better, and I'm sure there'll be somebody out there that prefers the older version, but I'm shipping it and moving on.

[![git-nomad 0.5.0 asciicast](https://asciinema.org/a/462028.svg)](https://asciinema.org/a/462028?autoplay=1)

## Changelog

2022-01-16: Published.


[git-nomad]: https://github.com/rraval/git-nomad
[asciinema]: https://asciinema.org/
[asciinema-helpers]: https://github.com/rraval/git-nomad/commit/2874bad7e8d810a5ab06370a6fcceae3ad384770#diff-206b9ce276ab5971a2489d75eb1b12999d4bf3843b7988cbe8d687cfde61dea0
[hackertyper]: https://hackertyper.net
[doitlive]: https://doitlive.readthedocs.io/en/stable/
[gist]: https://gist.github.com/TApplencourt/f9b586051cfe3a640ca8