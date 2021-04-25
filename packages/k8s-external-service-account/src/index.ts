import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

export class ExternalServiceAccount extends pulumi.ComponentResource {
    public readonly account: k8s.core.v1.ServiceAccount;
    public readonly token: pulumi.Output<string>;

    public constructor(
        name: string,
        args: k8s.core.v1.ServiceAccountArgs,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super("zeroindexed:k8s-external-service-account", name, args, opts);

        this.account = new k8s.core.v1.ServiceAccount("account", args, {
            parent: this,
        });

        // ServiceAccount resources automatically create a secret in the cluster
        // containing the access token, so we must query the cluster each time.
        const secret = k8s.core.v1.Secret.get(
            "secret",
            this.account.secrets.apply((secretArray) => {
                if (secretArray.length !== 1) {
                    throw new Error(
                        `Expected just a single secret token, got: ${secretArray.length}`,
                    );
                }

                return secretArray[0].name;
            }),
            {parent: this},
        );

        this.token = secret.data["token"].apply((encodedSecretToken) => {
            const decoded = Buffer.from(encodedSecretToken, "base64").toString("utf8");
            return pulumi.secret(decoded);
        });
    }
}
