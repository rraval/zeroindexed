---
permalink: /pgp-encryption-subkeys
title: PGP encryption subkeys are less useful than I thought
---

I recently [revisited how I was managing passwords][password-management] but wanted to maintain the core structure of secrets encrypted via a PGP key. PGP is a good fit here, these secrets are linked to my identity as a person, as opposed to secrets linked to a specific machine or service.

I already have [an established PGP key][rraval-pgp-key], but this use case demands distributing decryption capabilities to at least my primary computer and mobile phone. My existing PGP key is already used for a hodge podge of purposes, so to limit scope of compromise, it makes sense to generate an encryption and decryption scheme for the specific purpose of securing my passwords.

I thought I could simply generate a new PGP subkey tied to my main identity and this idea [seems to have some colloquial support][subkey-support]:

> Use one primary key for each _identity_ you need, otherwise, use subkeys.
>
> [...]
>
> Examples for using subkeys:
> - You want to use multiple keys for multiple devices (so you won't have to revoke your computer's key if you lose your mobile)

**tl;dr:** Don't bother. The PGP ecosystem does not support encryption subkeys for a specific purpose. You should just generate an entirely separate PGP key for your use case. For me securing passwords, I'm not even bothering to publish this new key to keyservers. The rest of this blog post is dedicated to describing the various rabbit holes I explored before settling on this "don't bother" conclusion.

<!--more-->

# PGP identities and keys

The previous paragraphs have used the words "identity" and "key" rather loosely, so let's bring some rigour here (though I'm optimizing for clarity and not pedantry so caveat emptor).

At the top level for PGP, there is a private/public keypair called the `mainkey`. This keypair is used to certify various `subkey`s as belonging to the `mainkey`.

Each `subkey` has associated [key flags][key-flags] which determine what operations this `subkey` is valid for. Besides ontological clarity, [this distinction contributes to the security properties of the overall system][key-flag-usage]:

> If you look into the details of the math of public-key encryption, you will discover that signing and decrypting are actually identical operations. Thus in a naïve implementation it is possible to trick somebody into decrypting a message by asking them to sign it.

The `mainkey` is also used to certify various `user id`s (also known as `UID`, `identity`), which usually ties the `mainkey` to one or more real world names and email addresses.

For more on this topic, the clearest explanation I can find is [Dave Steele's anatomy of a GPG key][gpg-key-anatomy].

# The ecosystem is simplistic

The initial thought is to simply associate some metadata with a specially generated `subkey` that identifies it as special-only-for-explicit-personal-use. The vague hope is to prevent others from implicitly using this key when sending me encrypted email or sharing work related secrets.

Unfortunately, the ecosystem doesn't support any metadata of the sort. You can [force GPG to use a specific subkey with an explicit invocation][gpg-specific-subkey]:

> When using `gpg` an exclamation mark (!) may be appended to force using the specified primary or secondary key and not to try and calculate which primary or secondary key to use.

However the [default behaviour for GPG makes it easy to do the wrong thing][debian-subkey]:

> If you have multiple encryption subkeys, gpg is said to encrypt only for the most recent encryption subkey and not for all known and not revoked encryption subkeys.

In a somewhat similar vein, [OpenKeychain][openkeychain-subkey] will encrypt to all subkeys with the encryption flag set, regardless of metadata:

> Since v 3.4 we encrypt to all subkeys with the capability flag for encryption: [7648602](https://github.com/open-keychain/open-keychain/commit/7648602fc876df3ec5827f3bba1ebbb8ae92eaae)

Overall, this means that ecosystem support for any sort of metadata of encryption `subkey` purpose is weak. It cannot be relied upon without rolling our own tools, which is already more work than I'm willing to get into.

# Key usage flags are not sufficient

I'm not the first person to have thought of using subkeys in this fashion, here's a [mailing list post by Mike Cardwell from almost a decade ago][ml1-problem] that's short enough to quote in its entirety:

> If I have more than one signing subkey in my keypair, is there a way of advertising the purpose of each subkey with the public key that people download? Eg:
>
> ```
> This subkey is for signing email only
> This subkey is for signing sourcecode only
> ```
>
> I've considered generating an entirely separate keypair and then cross-signing them, but that seems inelegant.

To which there is [a helpful reply by Daniel Kahn Gillmor][ml1-solution]:

> My first thought was to look up the list of standardized "key usage flags", which are defined here: [https://tools.ietf.org/html/rfc4880#section-5.2.3.21]()

Looking at the quoted RFC, there are no "key usage flags" that explicitly cover the usage I intend with my password management subkey:

```
0x01 - This key may be used to certify other keys.
```

Almost certainly not, the password subkey should not be certifying other keys.

```
0x02 - This key may be used to sign data.
```

No, we don't care for signing, just encrypting.

```
0x04 - This key may be used to encrypt communications.
```

For the password use case, this flag ought to be true. But this alone is ambiguous because there are other keys, like encrypted email, that would also have this bit set.

```
0x08 - This key may be used to encrypt storage.
```

This is the most promising flag but the RFC does not standardize the distinction:

> Note however, that it is a thorny issue to determine what is "communications" and what is "storage".  This decision is left wholly up to the implementation; the authors of this document do not claim any special wisdom on the issue and realize that accepted opinion may change.

In the 14 years since the publication of that RFC, it seems like implementations have not evolved a conventional distinction either.  Here's the [GPG source code][gpg-key-usage]:

```c
      /* We do not distinguish between encrypting communications and
         encrypting storage. */
      if (flags & (0x04 | 0x08))
        {
          key_usage |= PUBKEY_USAGE_ENC;
          flags &= ~(0x04 | 0x08);
        }
```

Which only leaves us with the last defined key usage bits:

```
0x10 - The private component of this key may have been split
       by a secret-sharing mechanism.

0x20 - This key may be used for authentication.

0x80 - The private component of this key may be in the
       possession of more than one person.
```

None of these are relevant to the encryption-for-passwords use case. Passwords are used for authentication and `0x20` mentions authentication, but the intent is for PGP subkeys that directly participate in the authentication scheme — like a PGP subkey that can also be an SSH key — instead of the indirect workflow of "subkey decrypts password then actor uses password to authenticate".

# Subkey notations have no adoption

Going back to [Daniel Kahn Gillmor's mailing list response][ml1-solution], they suggest an alternative form of subkey metadata called "notations":

> Instead, you could add a notation to the subkey signatures. [https://tools.ietf.org/html/rfc4880#section-5.2.3.16]()
>
> [...]
>
> You might want to discuss it with the (very low-traffic at the moment)
working group: IETF OpenPGP Working Group `<ietf-openpgp at imc.org>`

To summarize the RFC: notations are a standardized mechanism to add arbitrary name/value octet sequences to a subkey. The RFC even mitigates name collisions, private use should have an `@` while standardized notation names have no `@` but need to be registered with IANA.

Even though the RFC expends the energy to standardize notations, implementations and conventions haven't really capitalized on this affordance. [This StackExchange answer notes][notation-usage]:

> Notations are rarely used in practice (actually I've never seen real usage, although there are few notation subpackets to be found in key server dumps). Example usage might be to add the location of an identity check during key signing, or the document types presented.

As far as I can tell, there are no actual standardized notation names. The [IANA registry for PGP notations][notation-iana] is empty.

I did find this [IETF internet draft][notation-draft] that expands RFC 4880 to specify some standardized notation names and intended usage, but:

1. None of the 10 new notation names would fit this purpose of marking an encryption key as not fit for general communications.
2. The internet draft has expired and I don't know if it'll be picked up again and driven to consensus. Although it has been through 10 revisions and the expiry was only ~5 weeks ago, so clearly some people care.

# User IDs are not linked to subkeys

The final idea is to put this metadata in the comment field of a user ID linked to the `mainkey`. I'm guessing that this [mailing list post is after similar goals][ml2-question] (though it's phrased in [classic XY fashion][xy-problem], so who knows):

> Is it possible to have subkeys with different comments than the main key? How?

The mailing list question is based on a misunderstanding, user IDs can have arbitrary comments but [they are not linked to subkeys in any way][ml2-answer]:

> Both subkeys and user IDs are related to a mainkey. In this sense user IDs and  subkeys are on the same level. There is no such thing as a subkey user ID or a user ID subkey. User IDs are just "names" for a mainkey. You can add and remove user IDs and subkeys. They do not affect the other group.

So besides being unstandardized, user ID comments are simply the wrong tool for this purpose.

# Takeaways

Just generate a separate PGP `mainkey` for this specific purpose. Give it a distinct user ID for quick identification, I used [a plus sign on Gmail to mark the email address][gmail-plus]. Consider if this `mainkey` even needs to be published on public keyservers, I did not bother since this key is for private use and does not represent a person.

In May 2021, trying to use subkeys would be actively harmful. If the subkey were published alongside your existing `mainkey`, implementations would implicitly use it to encrypt communications intended for you. This adds additional awkwardness to the poor UX that PGP email already suffers.

# Changelog

2021-10-30: [Dave Steele](https://davesteele.github.io/) reached out over email and pointed out that GPG can indeed encrypt to an explicit subkey with an exclamation point syntax. [The earlier reference that claimed this couldn't be done](https://gpgtools.tenderapp.com/discussions/problems/8919-force-subkey-for-signing) has been removed.

2021-05-09: Published.

[password-management]: https://github.com/rraval/zeroindexed/issues/6
[rraval-pgp-key]: https://keys.openpgp.org/search?q=D7C7F5708E5AAFACE0ED8D4C5D18C31569142F5F
[subkey-support]: https://security.stackexchange.com/a/31598
[key-flags]: https://datatracker.ietf.org/doc/html/rfc4880#section-5.2.3.21
[key-flag-usage]: https://serverfault.com/a/399366
[gpg-key-anatomy]: https://davesteele.github.io/gpg/2014/09/20/anatomy-of-a-gpg-key/
[gpg-specific-subkey]: https://www.gnupg.org/documentation/manuals/gnupg/Specify-a-User-ID.html
[debian-subkey]: https://wiki.debian.org/Subkeys
[openkeychain-subkey]: https://github.com/open-keychain/open-keychain/issues/2281#issuecomment-370384337
[ml1-problem]: https://lists.gnupg.org/pipermail/gnupg-users/2011-December/043365.html
[ml1-solution]: https://lists.gnupg.org/pipermail/gnupg-users/2011-December/043366.html
[gpg-key-usage]: https://github.com/gpg/gnupg/blob/4fcfac6feb2a6c2b14883ba406afc917e8d4be42/g10/getkey.c#L2448
[notation-usage]: https://security.stackexchange.com/a/120662
[notation-iana]: https://www.iana.org/assignments/pgp-parameters/pgp-parameters.xhtml#pgp-parameters-6
[notation-draft]: https://www.ietf.org/archive/id/draft-ietf-openpgp-rfc4880bis-10.html#section-5.2.3.17
[ml2-question]: https://lists.gnupg.org/pipermail/gnupg-users/2013-November/048172.html
[ml2-answer]: https://lists.gnupg.org/pipermail/gnupg-users/2013-November/048176.html
[xy-problem]: https://xyproblem.info/
[gmail-plus]: https://support.google.com/a/users/answer/9308648
