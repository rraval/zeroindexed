---
permalink: /nix-ejection-problem
title: Nix solves the package manager ejection problem
---

This blog post operates on two levels.

On a very direct level, I built a desktop machine with an [AMD Radeon RX 5600 XT graphics card][gfx-card] and I've been fighting a rather annoying interaction with dual monitors on Linux. Here's how it goes:

1. After some defined period of inactivity, the system tries to standby / suspend / turn off both monitors.
2. Both monitors respond to the [DPMS commands][dpms] and briefly blank.
3. After a few seconds, one of them comes on again, quickly followed by the other one, in an arbitrary order.
4. XFCE "helpfully" detects this as a monitor hotplug event and pops open a display configuration dialog.

Stepping away to make a coffee now means periodic flickering and coming back to 5 - 10 XFCE monitor configuration dialogs taking over my screen. Very annoying!

Googling around finds this [Ubuntu issue][ubuntu-issue] from 2018 that seems to describe the same problem, but the documented workaround of `amdgpu.dc=0` as a kernel parameter does not work. My graphics card decides to go into a glitchfest and the kernel doesn't even make it past initrd.

That Ubuntu issue links to [this upstream Freedesktop issue][freedesktop-1], which is old enough to get migrated to [this new Freedesktop issue][freedesktop-2], where [some kind soul has put together a patch that applies cleanly on recent kernels][patch]. My understanding is that the monitor starts polling its inputs when it enters a DPMS mode, and the patch adjusts the timeouts on the driver to ignore the polling pulses instead of treating them as hotplug events.

So that's one level: write a blog post, stuff it with enough keywords that other affected users can find it, tell them to [USE THE KERNEL PATCH][patch] until a fix is integrated into the mainline. A decent public service, but on its own not _interesting_.

On a second level, I've recently been [experimenting with NixOS as my daily driver][rraval-nix] and it rises to this challenge in ways that ArchLinux never could.

<!--more-->

Package management on Linux has a colourful history, with various distributions intermixing technology with philosophy to produce whole system configurations that real people can run on real machines with varying amounts of productivity. You have the Slackware "our packages are just tarballs you can extract over `/`", the slightly more principled dpkg and RPM's of the world, the source-first approach preferred by Gentoo and ArchLinux, and the "invent the universe to bake a pie" doctrine that is Linux From Scratch.

However, all of them share the fundamental notion of what it means to be a package: a monolithic reusable artifact that can be installed on a user's machine. (Okay, Linux From Scratch doesn't really belong in this category, but does it really belong anywhere?)

And there lies the dilemma: if the user needs to go off the beaten path, like patch the damn Linux kernel, they must roll their own package. Sure, some distributions will let you [reuse their package building recipe and make the process straightforward][arch-patch-kernel], but:

- You are now no longer a package consumer, you are now a package developer, which is considered its own distinct category.
- Which means you get none of the nice workflows that package consumers enjoy. You are responsible for tracking security disclosures, software updates, and rebasing your changes on top of whatever base you're building off.

Put another way: [the package development workflow does not compose][does-not-compose].

In contrast, NixOS makes patching the kernel a four liner:

```
boot.kernelPatches = [{
  name = "amdgpu-sleep-fix";
  patch = ./amdgpu-sleep-fix.patch;
}];
```

And the "contrast" here isn't how easy NixOS makes this (though that is appreciated), it's that the intention of "build the existing NixOS kernel with just this patch applied" is being purely captured. That's only possible here because the package management strategy is underpinned by a real programming language where it is derivations all the way down.

There is no distinction between being a "package consumer" and a "package developer" here. I get all the updates that the people responsible for the NixOS kernel put out with no continuous maintenance on my part.

The JavaScript community has a good word for this kind of "stay on the beaten path and get updates" or "do your own thing but carry the maintenance and complexity burden". [They call it ejection][js-eject].

NixOS (and Nix, which is the practical underpinning that makes this all possible) present a composable solution to this package management ejection problem. And that is _interesting_!

# Changelog

2021-05-30: Published.

[gfx-card]: https://www.amd.com/en/products/graphics/amd-radeon-rx-5600-xt
[dpms]: https://wiki.archlinux.org/title/Display_Power_Management_Signaling
[ubuntu-issue]: https://bugs.launchpad.net/ubuntu/+source/linux/+bug/1790861
[freedesktop-1]: https://bugs.freedesktop.org/show_bug.cgi?id=109246
[freedesktop-2]: https://gitlab.freedesktop.org/drm/amd/-/issues/662
[patch]: https://gitlab.freedesktop.org/drm/amd/-/issues/662#note_909333
[rraval-nix]: https://github.com/rraval/nix
[arch-patch-kernel]: https://wiki.archlinux.org/title/Kernel/Arch_Build_System
[does-not-compose]: https://github.com/rraval/zeroindexed/issues/8
[js-eject]: https://create-react-app.dev/docs/available-scripts/#npm-run-eject