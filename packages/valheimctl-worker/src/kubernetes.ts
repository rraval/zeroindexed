import type {ValheimCtlConfig} from "./config";
import {asNumber, asString, debugRepr} from "./util";

class KubernetesResponse {
    private cachedJson: unknown;

    public constructor(
        public readonly url: string,
        public readonly status: number,
        public readonly responseText: string,
    ) {}

    private parseResponseAsJson(): unknown {
        if (this.cachedJson === undefined) {
            this.cachedJson = JSON.parse(this.responseText);
        }
        return this.cachedJson;
    }

    public debugRepr(): string {
        try {
            return debugRepr(this.parseResponseAsJson());
        } catch (e) {
            return this.responseText;
        }
    }

    public throwError(): never {
        throw new Error(`${this.url} => ${this.status}\n\n${this.responseText}`);
    }

    public assertStatus(status: number): void {
        if (this.status !== status) {
            this.throwError();
        }
    }

    public json(): unknown {
        try {
            return this.parseResponseAsJson();
        } catch (e) {
            throw new Error(`Not JSON? ${this.responseText}`);
        }
    }

    public static async request({
        config,
        path,
        method,
        headers,
        body,
    }: {
        config: ValheimCtlConfig;
        path: string;
        method: "GET" | "PATCH";
        headers?: Record<string, string>;
        body?: string;
    }): Promise<KubernetesResponse> {
        const request = new Request(`${config.k8sGateway}${path}`, {
            method,
            body,
            headers: {
                Authorization: `Bearer ${config.k8sToken}`,
                Accept: "application/json",
                ...headers,
            },
        });

        const response = await fetch(request);
        const responseText = await response.text();

        return new KubernetesResponse(request.url, response.status, responseText);
    }
}

export type PodStatus = {info: string} & (
    | {type: "noPod"}
    | {type: "transitioning"}
    | {type: "running"}
);

interface UnknownJson {
    [Key: string]: undefined | UnknownJson;
    [Key: number]: undefined | UnknownJson;
}

export class PodState {
    private readonly _nominalHack: unknown;

    public constructor(public readonly response: KubernetesResponse) {}

    public status(): PodStatus {
        if (this.response.status === 404) {
            return {
                type: "noPod",
                info: "No Pod",
            };
        }

        this.response.assertStatus(200);

        const containerStatuses = (this.response.json() as UnknownJson)?.["status"]?.[
            "containerStatuses"
        ];
        if (
            containerStatuses === undefined ||
            asNumber(containerStatuses["length"]) < 1
        ) {
            return {
                type: "transitioning",
                info: "Pending",
            };
        }

        const containerStatus = containerStatuses[0];

        const waitingReason = containerStatus?.["state"]?.["waiting"]?.["reason"];
        if (waitingReason !== undefined) {
            return {
                type: "transitioning",
                info: `Waiting: ${waitingReason}`,
            };
        }

        const terminatedReason = containerStatus?.["state"]?.["terminated"]?.["reason"];
        if (terminatedReason !== undefined) {
            return {
                type: "transitioning",
                info: `Terminated: ${waitingReason}`,
            };
        }

        const running = containerStatus?.["state"]?.["running"];
        if (running !== undefined) {
            return {
                type: "running",
                info: "Running",
            };
        }

        this.response.throwError();
    }

    public static async fromApi(config: ValheimCtlConfig): Promise<PodState> {
        const response = await KubernetesResponse.request({
            config,
            path: `/api/v1/namespaces/${config.namespace}/pods/${config.podName}`,
            method: "GET",
        });
        return new PodState(response);
    }
}

export class StatefulSetState {
    private readonly _nominalHack: unknown;

    public constructor(public readonly response: KubernetesResponse) {}

    public desiredReplicas(): number {
        return asNumber((this.response.json() as UnknownJson)?.["spec"]?.["replicas"]);
    }

    public runningReplicas(): number {
        return asNumber(
            (this.response.json() as UnknownJson)?.["status"]?.["replicas"],
        );
    }

    public static async fromApi(config: ValheimCtlConfig): Promise<StatefulSetState> {
        const response = await KubernetesResponse.request({
            config,
            path: `/apis/apps/v1/namespaces/${config.namespace}/statefulsets/${config.statefulSetName}`,
            method: "GET",
        });
        response.assertStatus(200);
        return new StatefulSetState(response);
    }
}

export class OdinState {
    private readonly nominalHack: unknown;

    public constructor(public readonly response: KubernetesResponse) {}

    public version(): string {
        this.response.assertStatus(200);
        return asString((this.response.json() as UnknownJson)?.["version"]);
    }

    public numPlayers(): number {
        this.response.assertStatus(200);
        return asNumber((this.response.json() as UnknownJson)?.["players"]);
    }

    public isOnline(): boolean {
        return this.response.status === 200;
    }

    public info(): string {
        if (this.isOnline()) {
            return `Server online (v${this.version()}), players: ${this.numPlayers()}`;
        } else if (this.response.status === 503) {
            return "Server offline";
        } else {
            this.response.throwError();
        }
    }

    public static async fromApi(config: ValheimCtlConfig): Promise<OdinState> {
        const response = await KubernetesResponse.request({
            config,
            path: `/api/v1/namespaces/${config.namespace}/services/${config.odinName}/proxy/status`,
            method: "GET",
        });
        return new OdinState(response);
    }
}

export async function scaleStatefulSet({
    config,
    replicas,
}: {
    config: ValheimCtlConfig;
    replicas: number;
}): Promise<Response> {
    const response = await KubernetesResponse.request({
        config,
        path: `/apis/apps/v1/namespaces/${config.namespace}/statefulsets/${config.statefulSetName}/scale`,
        method: "PATCH",
        headers: {
            "Content-Type": "application/strategic-merge-patch+json",
        },
        body: JSON.stringify({spec: {replicas}}),
    });
    response.assertStatus(200);

    return new Response("", {
        headers: {
            Location: "/",
        },
        status: 303,
    });
}
