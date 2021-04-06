export function debugRepr(thing: unknown): string {
    return JSON.stringify(thing, null, "    ");
}

export function asString(thing: unknown): string {
    if (typeof thing === "string") {
        return thing;
    }

    throw new Error(`Expected string, got ${typeof thing} ${debugRepr(thing)}`);
}

export function asNumber(thing: unknown): number {
    if (typeof thing === "number") {
        return thing;
    }

    throw new Error(`Expected number, got ${typeof thing} ${debugRepr(thing)}`);
}
