import type {ValheimCtlConfig} from "./config";

function timingSafeEquals(a: string, b: string): boolean {
    if (a.length !== b.length) {
        return false;
    }

    let isEqual = true;
    for (let i = 0; i < a.length; ++i) {
        isEqual &&= a.charAt(i) === b.charAt(i);
    }

    return isEqual;
}

export function isAuthorized(
    config: ValheimCtlConfig,
    authorization: string | null | undefined,
): boolean {
    if (authorization == null) {
        return false;
    }

    const [method, encoded] = authorization.split(" ", 2);
    if (method !== "Basic") {
        return false;
    }

    const decoded = atob(encoded);
    const [_user, password] = decoded.split(":", 2);

    return timingSafeEquals(password, config.password);
}
