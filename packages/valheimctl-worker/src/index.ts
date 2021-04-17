import {isAuthorized} from "./auth";
import {ValheimCtlConfig} from "./config";
import {scaleStatefulSet} from "./kubernetes";
import {observeAndPossiblyShutdown} from "./shutdown";
import {indexHtml} from "./ui";
import {debugRepr} from "./util";

addEventListener("fetch", (event) => {
    const config = ValheimCtlConfig.fromGlobalThis();
    event.respondWith(
        onFetch(config, event.request).catch((e: unknown) => {
            return Promise.resolve(
                new Response(debugRepr(e), {
                    headers: {
                        "Content-Type": "text/plain; charset=UTF-8",
                    },
                }),
            );
        }),
    );
});

addEventListener("scheduled", (event) => {
    const config = ValheimCtlConfig.fromGlobalThis();
    event.waitUntil(observeAndPossiblyShutdown(config));
});

async function onFetch(config: ValheimCtlConfig, request: Request): Promise<Response> {
    const {method, headers} = request;
    const url = new URL(request.url);

    if (!isAuthorized(config, headers.get("Authorization"))) {
        return Promise.resolve(
            new Response("", {
                status: 401,
                headers: {
                    "WWW-Authenticate": `Basic realm="valheimctl"`,
                },
            }),
        );
    }

    if (method === "GET" && url.pathname === "/") {
        return indexHtml({
            config,
            debug: url.search.indexOf("debug") !== -1,
        });
    }

    const actor = headers.get("CF-Connecting-IP") ?? "Unknown IP";

    if (method === "POST" && url.pathname === "/start") {
        const [, response] = await Promise.all([
            config.actorLogger?.log(`${actor} started the server`),
            scaleStatefulSet({config, replicas: 1}),
        ]);
        return response;
    }

    if (method === "POST" && url.pathname === "/stop") {
        const [, response] = await Promise.all([
            config.actorLogger?.log(`${actor} stopped the server`),
            scaleStatefulSet({config, replicas: 0}),
        ]);
        return response;
    }

    return Promise.resolve(new Response("", {status: 404}));
}
