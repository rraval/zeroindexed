import type {Entry} from "@zeroindexed/cloudflare-kv-log";
import type {HtmlSafeString} from "escape-html-template-tag";
import html from "escape-html-template-tag";

import type {ValheimCtlConfig} from "./config";
import {StatefulSetState, PodState, OdinState} from "./kubernetes";
import {OdinObservation} from "./shutdown";
import {debugRepr} from "./util";

function isTransitioning({
    statefulSetState,
    podState,
    odinState,
}: {
    statefulSetState: StatefulSetState;
    podState: PodState;
    odinState: OdinState;
}): boolean {
    if (statefulSetState.desiredReplicas() !== statefulSetState.runningReplicas()) {
        return true;
    }

    const podStatus = podState.status();
    return (
        podStatus.type === "transitioning" ||
        (podStatus.type === "running" && !odinState.isOnline())
    );
}

export async function indexHtml({
    config,
    debug,
}: {
    config: ValheimCtlConfig;
    debug: boolean;
}): Promise<Response> {
    const [
        statefulSetState,
        podState,
        odinState,
        actorLogs,
        idleShutdownLogs,
    ] = await Promise.all([
        StatefulSetState.fromApi(config),
        PodState.fromApi(config),
        OdinState.fromApi(config),
        config.actorLogger?.newest(),
        config.idleShutdownLogger?.newest(),
    ]);

    const autoRefresh =
        !debug &&
        isTransitioning({
            statefulSetState,
            podState,
            odinState,
        });

    const responseHtml = html`
        <!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>Valheim Controller</title>

                <style>
                    * {
                        font-family: sans;
                        margin: 0;
                        padding: 0;
                        line-height: 1.25;
                        font-weight: normal;
                        box-sizing: border-box;
                    }

                    body {
                        background: #f1f1f1;
                        color: #111111;
                        margin: 0;
                    }

                    #panel {
                        background: #ffffff;
                        border: 1px solid #111111;
                        border-radius: 4px;
                        margin: 48px auto;
                        max-width: 720px;
                    }

                    #panel-controls {
                        display: flex;
                        margin: 0px 12px 24px 12px;
                        align-items: center;
                    }

                    form {
                        flex: 0 0 auto;
                        margin: 0px 12px;
                    }

                    label {
                        flex: 1 0 auto;
                        margin: 0px 24px;
                    }

                    input[type="submit"] {
                        padding: 12px;
                        border: none;
                        color: #ffffff;
                        background: #51735d;
                        border-radius: 4px;
                        transition: all 0.4s ease;
                        cursor: pointer;
                    }

                    input[type="submit"]:hover {
                        background: #8ca680;
                    }

                    input[type="checkbox"] {
                        width: 1.5em;
                        height: 1.5em;
                        vertical-align: middle;
                        cursor: pointer;
                    }

                    h1 {
                        font-size: 2em;
                    }

                    #panel h1 {
                        margin: 24px 24px 8px 24px;
                    }

                    #panel-info {
                        display: flex;
                        border-top: 1px solid #111111;
                    }

                    #panel-info > dl {
                        flex: 1 1 0px;
                        padding: 24px;
                        border-left: 1px solid #111111;
                    }

                    #panel-info > dl:first-child {
                        border-left: none;
                    }

                    #logs {
                        border-top: 1px solid black;
                        padding: 24px;
                    }

                    #logs time {
                        font-weight: bold;
                    }

                    #debug {
                        padding: 24px;
                    }

                    #debug h1 {
                        margin: 24px 0px 8px 0px;
                    }

                    code {
                        font-family: monospace;
                        white-space: pre;
                        overflow: scroll;
                    }
                </style>

                <script>
                    document.addEventListener("DOMContentLoaded", function () {
                        var refreshElem = document.getElementById("refresh");
                        var checkAndMaybeRefresh = function () {
                            if (refreshElem.checked) {
                                window.location.reload();
                            }
                            setTimeout(checkAndMaybeRefresh, 2000);
                        };
                        setTimeout(checkAndMaybeRefresh, 2000);
                    });

                    document.addEventListener("DOMContentLoaded", function () {
                        var formatter = new Intl.DateTimeFormat([], {
                            dateStyle: "medium",
                            timeStyle: "medium"
                        });

                        document.querySelectorAll("time").forEach(function (timeElem) {
                            var instant = timeElem.getAttribute("datetime");
                            if (instant == null) {
                                return;
                            }

                            timeElem.innerText = formatter.format(new Date(instant));
                        });
                    });
                </script>
            </head>
            <body>
                <div id="panel">
                    <h1>${odinState.info()}</h1>

                    <div id="panel-controls">
                        <form method="POST" action="/start">
                            <input type="submit" value="Start" />
                        </form>

                        <form method="POST" action="/stop">
                            <input type="submit" value="Stop" />
                        </form>

                        <label>
                            <input
                                id="refresh"
                                type="checkbox"
                                ${autoRefresh ? "checked" : ""}
                            />
                            Refresh every 2 seconds
                        </label>
                    </div>

                    <div id="panel-info">
                        <dl>
                            <dt>Pods Desired</dt>
                            <dd>${statefulSetState.desiredReplicas()}</dd>
                        </dl>

                        <dl>
                            <dt>Pods Scheduled</dt>
                            <dd>${statefulSetState.runningReplicas()}</dd>
                        </dl>

                        <dl>
                            <dt>Phase</dt>
                            <dd>${podState.status().info}</dd>
                        </dl>
                    </div>

                    <div id="logs">
                        ${logHtml("Actor Logs", actorLogs)}
                        ${logHtml("Idle Shutdown Logs", idleShutdownLogs)}
                    </div>
                </div>

                ${debug
                    ? await debugHtml({config, statefulSetState, podState, odinState})
                    : ""}
            </body>
        </html>
    `;
    return new Response(responseHtml.toString(), {
        headers: {
            "Content-Type": "text/html; charset=UTF-8",
        },
    });
}

function logHtml(title: string, logs: undefined | Array<Entry>): HtmlSafeString {
    if (logs == null || logs.length === 0) {
        return html``;
    }

    return html`
        <details>
            <summary>${title}</summary>
            ${logs.map(logEntryHtml)}
        </details>
    `;
}

function logEntryHtml(entry: Entry): HtmlSafeString {
    const instant = new Date(entry.instant).toISOString();
    return html`
        <p>
            <time datetime="${instant}">${instant}</time>
            ${entry.message}
        </p>
    `;
}

async function debugHtml({
    config,
    statefulSetState,
    podState,
    odinState,
}: {
    config: ValheimCtlConfig;
    statefulSetState: StatefulSetState;
    podState: PodState;
    odinState: OdinState;
}): Promise<HtmlSafeString> {
    const shutdownText = await OdinObservation.get(config)
        .then((observation) => debugRepr(observation))
        .catch((e) => debugRepr(e));

    return html`
        <div id="debug">
            <h1>Debug</h1>
            <details>
                <summary>Stateful Set</summary>
                <code>${statefulSetState.response.debugRepr()}</code>
            </details>
            <details>
                <summary>Pod</summary>
                <code>${podState.response.debugRepr()}</code>
            </details>
            <details>
                <summary>Odin</summary>
                <code>${odinState.response.debugRepr()}</code>
            </details>
            <details>
                <summary>Idle Shutdown</summary>
                <code>${shutdownText}</code>
            </details>
        </div>
    `;
}
