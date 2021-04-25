import {makeBlog} from "./blog";
import {Config} from "./config";
import {makeKubernetes} from "./kubernetes";
import {makeValheim} from "./valheim";

const config = Config.fromPulumi();
const {cluster, provider} = makeKubernetes(config);

makeBlog(config);

makeValheim({
    config,
    cluster,
    provider,
});
