import {arrayBufferToHex, uuid4} from "@zeroindexed/binutil";

const encoder = new TextEncoder();

async function sha256(payload: string): Promise<string> {
    const payloadBytes = encoder.encode(payload);
    const digestBytes = await crypto.subtle.digest({name: "SHA-256"}, payloadBytes);
    return arrayBufferToHex(digestBytes);
}

async function clientIdUuid({
    kv,
    ipAddress,
    userAgent,
    timeoutSeconds,
}: {
    kv: KVNamespace;
    ipAddress: string;
    userAgent: string;
    timeoutSeconds: number;
}): Promise<string> {
    const hash = await sha256(`${ipAddress}:${userAgent}`);

    const existingUuid = await kv.get(hash, {
        type: "text",
        // Make lookups even faster by caching UUIDs near the requester.
        // This does mean that expiration is not exact and the lifetime can be
        // extended to `1.5 * timeoutSeconds`.
        cacheTtl: timeoutSeconds / 2,
    });
    if (existingUuid != null) {
        return existingUuid;
    }

    const newUuid = uuid4();
    await kv.put(hash, newUuid, {
        expirationTtl: timeoutSeconds,
    });

    return newUuid;
}

export interface ClientId {
    uuid: string;
}

export const ClientId = {
    async fromRequest({
        kv,
        request,
        timeoutSeconds,
    }: {
        kv: KVNamespace;
        request: Request;
        timeoutSeconds: number;
    }): Promise<ClientId | null> {
        const ipAddress = request.headers.get("CF-Connecting-IP");
        if (ipAddress == null) {
            return null;
        }

        const userAgent = request.headers.get("User-Agent") ?? "";

        const uuid = await clientIdUuid({
            kv,
            ipAddress,
            userAgent,
            timeoutSeconds,
        });

        return {uuid};
    },
};
