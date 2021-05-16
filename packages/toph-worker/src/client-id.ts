import {arrayBufferToHex, uuid4} from "@zeroindexed/binutil";

import type {Expiration, Extension} from "./newtype";

export class SessionConfig {
    private readonly kv: KVNamespace;
    private readonly expiration: Expiration;
    private readonly extension: Extension;

    public constructor({
        kv,
        expiration,
        extension,
    }: {
        kv: KVNamespace;
        expiration: Expiration;
        extension: Extension;
    }) {
        this.kv = kv;
        this.expiration = expiration;
        this.extension = extension;
    }

    private cacheTtl(): number {
        // Docs say that this needs to be at least 60 seconds
        // https://developers.cloudflare.com/workers/runtime-apis/kv#cache-ttl
        //
        // This may mean that session durations last
        // `expiration + this.cacheTtl()` if the client ID gets cached
        // at the edge right as it's about to expire.
        return Math.max(60, this.extension.value);
    }

    public shouldExtend(instant: number | null): boolean {
        // Something has eaten the metadata, extend to be safe
        if (instant == null) {
            return true;
        }

        return Date.now() - instant >= this.extension.value;
    }

    public async get(
        hash: string,
    ): Promise<null | {uuid: string; instant: number | null}> {
        const entry = await this.kv.getWithMetadata(hash, {
            type: "text",
            cacheTtl: this.cacheTtl(),

            // The docs say:
            //
            // > You can pass an options object with `type` and/or `cacheTtl`
            // > parameters to the `getWithMetadata` method, similar to `get`.
            //
            // https://developers.cloudflare.com/workers/runtime-apis/kv#metadata-1
            //
            // ... but the type annotations don't expose this so use an `as any`.
            //
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);

        if (entry.value == null) {
            return null;
        }

        return {
            uuid: entry.value,
            instant: extractInstantFromMetadata(entry.metadata),
        };
    }

    public put(hash: string, uuid: string): Promise<void> {
        return this.kv.put(hash, uuid, {
            expirationTtl: this.expiration.value,
            metadata: {
                instant: Date.now(),
            },
        });
    }
}

const encoder = new TextEncoder();

async function sha256(payload: string): Promise<string> {
    const payloadBytes = encoder.encode(payload);
    const digestBytes = await crypto.subtle.digest({name: "SHA-256"}, payloadBytes);
    return arrayBufferToHex(digestBytes);
}

async function clientIdUuid({
    sessionConfig,
    ipAddress,
    userAgent,
}: {
    sessionConfig: SessionConfig;
    ipAddress: string;
    userAgent: string;
}): Promise<string> {
    const hash = await sha256(`${ipAddress}:${userAgent}`);
    const existing = await sessionConfig.get(hash);

    if (existing != null) {
        if (sessionConfig.shouldExtend(existing.instant)) {
            sessionConfig.put(hash, existing.uuid);
        }
        return existing.uuid;
    } else {
        const newUuid = uuid4();
        await sessionConfig.put(hash, newUuid);
        return newUuid;
    }
}

export interface ClientId {
    uuid: string;
}

export const ClientId = {
    async fromRequest({
        sessionConfig,
        request,
    }: {
        sessionConfig: SessionConfig;
        request: Request;
    }): Promise<ClientId | null> {
        const ipAddress = request.headers.get("CF-Connecting-IP");
        if (ipAddress == null) {
            return null;
        }

        const userAgent = request.headers.get("User-Agent") ?? "";

        const uuid = await clientIdUuid({
            sessionConfig,
            ipAddress,
            userAgent,
        });

        return {uuid};
    },
};

function isObject(thing: unknown): thing is Record<string, unknown> {
    return thing != null && typeof thing === "object";
}

function extractInstantFromMetadata(metadata: unknown): number | null {
    if (!isObject(metadata)) {
        return null;
    }

    const {instant} = metadata;
    if (typeof instant !== "number") {
        return null;
    }

    return instant;
}
