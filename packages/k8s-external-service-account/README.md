# @zeroindexed/k8s-external-service-account

Pulumi component to export Kubernetes service account tokens for out of cluster use.

## Motivation

Kubernetes has built in support for [`ServiceAccount`s][service-account], which combined with [`RoleBinding`s][role-binding], offers automated access to the apiserver and thus the Kubernetes control plane. API access is authenticated by [`ServiceAccount` bearer tokens][service-account-auth], which can be exposed to allow manipulation of cluster state by services outside the Kubernetes cluster.

Trouble arises because `ServiceAccount`s automatically create the token with an arbitrarily chosen name suffix, which presents challenges for Pulumi's declarative resource management.

After trying a few solutions (including hacks with [`import`][pulumi-import]), this package provides what appears to be the optimal approach: querying the cluster to find the token. This does incur a minor performance cost for pulumi operations.

## Usage

Use within your own components or directly:

```ts
import {ExternalServiceAccount} from "@zeroindexed/k8s-external-service-account";

const serviceAccount = new ExternalServiceAccount(
    "someServiceName",
    {
        // Pass along any `ServiceAccountArgs`
        metadata: {
            labels: {
                "app.kubernetes.io/name": "someServiceName",
            },
        },
    },
    // Pass a parent for your own component
    {parent: this},
);

// The token for use outside the cluster.
// This is the actual value that has already been base64 decoded.
export const token = serviceAccount.token;

// The actual name of the resource after Pulumi's autonaming
export const name = serviceAccount.account.metadata.name;
```

[service-account]: https://kubernetes.io/docs/tasks/configure-pod-container/configure-service-account/
[role-binding]: https://kubernetes.io/docs/reference/access-authn-authz/rbac/#rolebinding-and-clusterrolebinding
[service-account-auth]: https://kubernetes.io/docs/reference/access-authn-authz/authentication/#service-account-tokens
[pulumi-import]: https://www.pulumi.com/blog/adopting-existing-cloud-resources-into-pulumi/#adopting-existing-resources
