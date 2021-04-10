export function debugRepr(thing: unknown): string {
    if (thing instanceof Error) {
        return thing.stack ?? `${thing.name}: ${thing.message}`;
    } else {
        return JSON.stringify(thing, null, "    ");
    }
}

export function asString(thing: unknown): string {
    if (typeof thing === "string") {
        return thing;
    }

    throw new Error(`Expected string, got ${typeof thing} ${debugRepr(thing)}`);
}

export function asOptional<T>(
    converter: (thing: unknown) => T,
    thing: unknown,
): T | null {
    if (thing == null) {
        return null;
    }

    return converter(thing);
}

export function asNumber(thing: unknown): number {
    if (typeof thing === "number") {
        return thing;
    }

    throw new Error(`Expected number, got ${typeof thing} ${debugRepr(thing)}`);
}

export function asNumberString(thing: unknown): number {
    const str = asString(thing);
    const num = parseInt(str, 10);
    if (Number.isNaN(num)) {
        throw new Error(`Expected number, got ${debugRepr(str)}`);
    }
    return num;
}

export function asObject(thing: unknown): Record<PropertyKey, unknown> {
    if (typeof thing === "object" && thing !== null) {
        // This is a better type than `object`
        return thing as Record<PropertyKey, unknown>;
    }

    throw new Error(`Expected object, got ${typeof thing} ${debugRepr(thing)}`);
}
