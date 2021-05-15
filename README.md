# ZeroIndexed

Monorepo for first party source code that runs under zeroindexed.com.

JavaScript packages are published under the `@zeroindexed/` namespace on NPM.

## Development

Install [`nix`][nix] and [`nix-direnv`][nix-direnv] (which are part of the
[`rravalBox` nix configuration][rravalBox], so that comes for free if you're
using it).

Ensure that your `nix` config supports [`nix flake`][nix-flake].

Then add a file to the root of this repo `.envrc`:

```
use flake
```

Finally:

```
$ cd /path/to/this/repo

# needed every time `.envrc` changes, rare.
$ direnv allow

# Needed every time `docs/Gemfile.lock` changes, somewhat frequent.
$ (cd docs && bundle install)

# Needed every time `yarn.lock` changes, frequent.
$ yarn install
```

## Deployment

Everything is managed by [`pulumi`][pulumi], which is already installed in the
`nix` managed environment.

### Pulumi

Modify `$ZEROINDEXED_CHECKOUT/.envrc`:

```
# Create an access token: https://app.pulumi.com/account/tokens
export PULUMI_ACCESS_TOKEN="..."

# gpg -d packages/pulumi/pulumi.passphrase.gpg
export PULUMI_CONFIG_PASSPHRASE="..."
```

### Google Cloud

Create a service account key and put the key in
`$ZEROINDEXED_CHECKOUT/.nix/gcloud-key.json`:
https://console.cloud.google.com/iam-admin/serviceaccounts

### kubectl

Generate a configuration file:

```
$ pulumi -C packages/pulumi stack --stack gcloud --show-secrets output kubeconfig > .nix/kubeconfig
```

[nix]: https://nixos.org/download.html#nix-quick-install
[nix-direnv]: https://github.com/nix-community/nix-direnv#installation
[rravalBox]: https://github.com/rraval/nix/commit/4099f6375a6bee12091b54ac62736916d8bdecbf
[nix-flake]: https://nixos.wiki/wiki/Flakes
[pulumi]: https://www.pulumi.com/
