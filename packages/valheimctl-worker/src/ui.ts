import html from "escape-html-template-tag";

import type {ValheimCtlConfig} from "./config";
import {StatefulSetState, PodState, OdinState} from "./kubernetes";
import {OdinObservation} from "./shutdown";
import {debugRepr} from "./util";

type HtmlSafeString = ReturnType<typeof html>;

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
    const [statefulSetState, podState, odinState] = await Promise.all([
        StatefulSetState.fromApi(config),
        PodState.fromApi(config),
        OdinState.fromApi(config),
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
                        padding: 0 12px 12px 12px;
                        align-items: center;
                        flex-wrap: wrap;
                    }

                    form {
                        flex: 0 0 auto;
                        margin: 12px;
                    }

                    label {
                        flex: 1 0 auto;
                        margin: 12px;
                    }

                    input[type="submit"] {
                        padding: 12px;
                        border: none;
                        color: #ffffff;
                        background: #0095ff;
                        border-radius: 4px;
                        transition: all 0.4s ease;
                        cursor: pointer;
                    }

                    input[type="submit"]:hover,
                    input[type="submit"]:focus {
                        background: #0077cc;
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
                        margin: 24px 24px 0px 24px;
                    }

                    #panel-info {
                        display: flex;
                        border-top: 1px solid #111111;
                        flex-wrap: wrap;
                    }

                    #panel-info > dl {
                        flex: 1 1 0px;
                        padding: 24px;
                    }

                    #panel-info > dl:first-child {
                        border-left: none;
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

                    @media only screen and (max-width: 720px) {
                        body {
                            background: #ffffff;
                        }

                        #panel {
                            border-width: 0px;
                        }
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
                </script>
            </head>
            <body>
                <div id="panel">
                    <h1>${odinState.info()}</h1>

                    <div id="panel-controls">
                        ${buttonHtml(statefulSetState)}

                        <label>
                            <input
                                id="refresh"
                                type="checkbox"
                                ${autoRefresh ? "checked" : ""}
                            />
                            Auto Refresh
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

function buttonHtml(statefulSetState: StatefulSetState): HtmlSafeString {
    if (statefulSetState.desiredReplicas() > 0) {
        return html`
            <form method="POST" action="/stop">
                <input type="submit" value="Stop Server" />
            </form>
        `;
    } else {
        return html`
            <form method="POST" action="/start">
                <input type="submit" value="Start Server" />
            </form>
        `;
    }
}

function debugPromise<T>(promise: Promise<T> | undefined): Promise<string> {
    if (promise == null) {
        return Promise.resolve("undefined");
    }
    return promise.then(debugRepr).catch(debugRepr);
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
    const [actorLogs, idleShutdownLogs, odinObservation] = await Promise.all([
        debugPromise(config.actorLogger?.newest()),
        debugPromise(config.idleShutdownLogger?.newest()),
        debugPromise(OdinObservation.get(config)),
    ]);

    return html`
        <div id="debug">
            <h1>Debug</h1>
            <details>
                <summary>Actor Logs</summary>
                <code>${actorLogs}</code>
            </details>
            <details>
                <summary>Idle Shutdown Logs</summary>
                <code>${idleShutdownLogs}</code>
            </details>
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
                <summary>Odin Observation</summary>
                <code>${odinObservation}</code>
            </details>
        </div>
    `;
}
