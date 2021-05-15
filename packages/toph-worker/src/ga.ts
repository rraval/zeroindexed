import type {ClientId} from "./client-id";

function encodePayload(params: Record<string, string>): string {
    const parts: Array<string> = [];

    for (const [key, value] of Object.entries(params)) {
        parts.push(`${key}=${encodeURIComponent(value)}`);
    }

    return parts.join("&");
}

export async function sendPageView({
    trackingId,
    documentLocation,
    clientId,
}: {
    trackingId: string;
    documentLocation: string;
    clientId: ClientId;
}): Promise<void> {
    const hit = new Request("https://www.google-analytics.com/collect", {
        method: "POST",
        body: encodePayload({
            v: "1", // Protocol Version
            tid: trackingId, // Tracking ID
            aip: "1", // Anonymize IP
            cid: clientId.uuid, //  Client ID
            t: "pageview", // Hit type
            dl: documentLocation, // Document location URL
        }),
    });

    const response = await fetch(hit);
    if (response.status < 200 || response.status >= 300) {
        throw new Error(`GA responded with status ${response.status}`);
    }
}
