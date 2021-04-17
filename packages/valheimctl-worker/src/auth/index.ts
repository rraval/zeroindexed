import type {ValheimCtlConfig} from "../config";

export function timingSafeEquals(a: string, b: string): boolean {
    if (a.length !== b.length) {
        return false;
    }

    let isEqual = true;
    for (let i = 0; i < a.length; ++i) {
        isEqual &&= a.charAt(i) === b.charAt(i);
    }

    return isEqual;
}

class Password {
    public constructor(private readonly value: string) {}

    public isEqual(other: string): boolean {
        return timingSafeEquals(this.value, other);
    }
}

export function decodeHttpBasicAuthorization(
    header: string | null | undefined,
): null | {user: string; password: Password} {
    if (header == null) {
        return null;
    }

    const [method, encoded] = header.split(" ", 2);
    if (method !== "Basic") {
        return null;
    }

    const decoded = atob(encoded);
    const firstColonIndex = decoded.indexOf(":");
    if (firstColonIndex === -1) {
        return null;
    }

    return {
        user: decoded.substring(0, firstColonIndex),
        password: new Password(decoded.substring(firstColonIndex + 1)),
    };
}

export function isAuthorized(
    config: ValheimCtlConfig,
    header: string | null | undefined,
): boolean {
    const auth = decodeHttpBasicAuthorization(header);
    if (auth == null) {
        return false;
    }

    return auth.password.isEqual(config.password);
}
