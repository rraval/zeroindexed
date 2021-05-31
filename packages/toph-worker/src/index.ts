import {ClientId, SessionConfig} from "./client-id";
import {sendPageView} from "./ga";
import {Expiration, Extension} from "./newtype";
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
    defaultSessionExpiration: Expiration;
    defaultSessionExtension: Extension;
    rootRedirect: string | null;
}

const TophConfig = {
    fromGlobalThis(): TophConfig {
        const env: Record<string, unknown> = globalThis;

        const trackingId = env["TRACKING_ID"];
        if (typeof trackingId !== "string") {
            throw new Error("TRACKING_ID is not a string");
        }

        const defaultSessionExpiration = Expiration(
            asNumber(
                env["DEFAULT_SESSION_EXPIRATION_SECONDS"],
                "DEFAULT_SESSION_EXPIRATION_SECONDS",
            ),
        );

        const defaultSessionExtension = Extension(
            asNumber(
                env["DEFAULT_SESSION_EXTENSION_SECONDS"],
                "DEFAULT_SESSION_EXTENSION_SECONDS",
            ),
        );

        const kv = env["KV"];
        if (typeof kv !== "object") {
            throw new Error("KV is not an object");
        }

        let rootRedirect: string | null = null;
        if (typeof env["ROOT_REDIRECT"] === "string") {
            rootRedirect = env["ROOT_REDIRECT"];
        }

        return {
            kv: kv as KVNamespace,
            trackingId,
            defaultSessionExpiration,
            defaultSessionExtension,
            rootRedirect,
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

    if (url.pathname === "/") {
        if (config.rootRedirect == null) {
            return buildTextResponse({
                status: 404,
                body: "No ROOT_REDIRECT set",
            });
        } else {
            return new Response("", {
                status: 302,
                headers: {
                    Location: config.rootRedirect,
                },
            });
        }
    }

    if (url.pathname === "/pageview") {
        const pageView = PageViewRequest.fromRequest(request, {
            defaultSessionExpiration: config.defaultSessionExpiration,
            defaultSessionExtension: config.defaultSessionExtension,
        });
        if (pageView == null) {
            return buildTextResponse({
                status: 400,
                body: "Cannot figure out document location",
            });
        }

        if (pageView.sessionExtension.value >= pageView.sessionExpiration.value) {
            return buildTextResponse({
                status: 400,
                body: `Extension (${pageView.sessionExtension.value}) must be smaller than expiration (${pageView.sessionExpiration.value})`,
            });
        }

        const sessionConfig = new SessionConfig({
            kv: config.kv,
            expiration: pageView.sessionExpiration,
            extension: pageView.sessionExtension,
        });

        const clientId = await ClientId.fromRequest({
            sessionConfig,
            request,
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
