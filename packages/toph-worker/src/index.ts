import {ClientId} from "./client-id";
import {sendPageView} from "./ga";
import {PageViewRequest} from "./pageview";

function debugRepr(thing: unknown): string {
    if (thing instanceof Error) {
        return thing.stack ?? `${thing.name}: ${thing.message}`;
    } else {
        return JSON.stringify(thing, null, "    ");
    }
}

function buildTextResponse({status, body}: {status: number; body: string}): Response {
    return new Response(body, {
        status,
        headers: {
            "Cache-Control": "no-store, max-age=0",
            "Content-Type": "text/plain; charset=UTF-8",
        },
    });
}

interface TophConfig {
    kv: KVNamespace;
    trackingId: string;
    defaultSessionDurationSeconds: number;
}

function asNumber(thing: unknown, source: string): number {
    if (typeof thing === "number") {
        return thing;
    }

    if (typeof thing === "string") {
        const num = Number.parseInt(thing, 10);
        if (!Number.isNaN(num)) {
            return num;
        }
    }

    throw new Error(`${source} is not a number`);
}

const TophConfig = {
    fromGlobalThis(): TophConfig {
        const env: Record<string, unknown> = globalThis;

        const trackingId = env["TRACKING_ID"];
        if (typeof trackingId !== "string") {
            throw new Error("TRACKING_ID is not a string");
        }

        const defaultSessionDurationSeconds = asNumber(
            env["DEFAULT_SESSION_DURATION_SECONDS"],
            "DEFAULT_SESSION_DURATION_SECONDS",
        );

        const kv = env["KV"];
        if (typeof kv !== "object") {
            throw new Error("KV is not an object");
        }

        return {
            kv: kv as KVNamespace,
            trackingId,
            defaultSessionDurationSeconds,
        };
    },
};

addEventListener("fetch", (event) => {
    event.respondWith(
        onFetch(event.request).catch((e: unknown) => {
            return Promise.resolve(
                buildTextResponse({
                    status: 500,
                    body: debugRepr(e),
                }),
            );
        }),
    );
});

async function onFetch(request: Request): Promise<Response> {
    const config = TophConfig.fromGlobalThis();
    const url = new URL(request.url);

    if (url.pathname === "/pageview") {
        const pageView = PageViewRequest.fromRequest(request, {
            defaultSessionDurationSeconds: config.defaultSessionDurationSeconds,
        });
        if (pageView == null) {
            return buildTextResponse({
                status: 400,
                body: "Cannot figure out document location",
            });
        }

        const clientId = await ClientId.fromRequest({
            kv: config.kv,
            request,
            timeoutSeconds: pageView.sessionDurationSeconds,
        });

        if (clientId == null) {
            return buildTextResponse({
                status: 400,
                body: "Cannot figure out client ID",
            });
        }

        await sendPageView({
            clientId,
            documentLocation: pageView.documentLocation,
            trackingId: config.trackingId,
        });

        return buildTextResponse({
            status: 204,
            body: "",
        });
    }

    return buildTextResponse({
        status: 404,
        body: `Unknown path: ${url.pathname}`,
    });
}
