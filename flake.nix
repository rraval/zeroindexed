{
  description = "Development environment for zeroindexed.com";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }: flake-utils.lib.eachDefaultSystem (system: let
    pkgs = nixpkgs.legacyPackages.${system};
  in {
    devShell = pkgs.mkShell {
      buildInputs = with pkgs; [
        google-cloud-sdk
        nodejs
        pulumi-bin
        ruby_2_7
        yarn
      ];
      shellHook = ''
        export ZEROINDEXED_CHECKOUT="$(pwd)"
        export GEM_HOME="$ZEROINDEXED_CHECKOUT/.nix/gem"
        export PATH="$ZEROINDEXED_CHECKOUT/node_modules/.bin:$ZEROINDEXED_CHECKOUT/.nix/gem/bin:$PATH"

        export PULUMI_HOME="$ZEROINDEXED_CHECKOUT/.nix/pulumi"
        export PULUMI_PREFER_YARN=true

        export KUBECONFIG="$ZEROINDEXED_CHECKOUT/.nix/kubeconfig"

        GCLOUD_KEY="$ZEROINDEXED_CHECKOUT/.nix/gcloud-key.json"
        if [[ -e "$GCLOUD_KEY" ]]; then
            export CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE="$GCLOUD_KEY"
            export GOOGLE_CREDENTIALS=$(cat "$GCLOUD_KEY")
        fi
      '';
    };
  });
}
