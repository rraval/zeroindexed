import * as pulumi from "@pulumi/pulumi";

import {makeBlog} from "./blog";
import {Config} from "./config";
import {makeKubernetes} from "./kubernetes";
import {makeToph} from "./toph";
import {makeValheim} from "./valheim";

const config = Config.fromPulumi();
const kubernetes = makeKubernetes(config);
const {cluster, provider} = kubernetes;

// Not really a secret but it also prevents this big string from being printed
// on every `pulumi up`.
export const kubeconfig = pulumi.secret(kubernetes.kubeconfig);

makeToph(config);
makeBlog(config);

makeValheim({
    config,
    cluster,
    provider,
});
