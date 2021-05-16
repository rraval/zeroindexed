import {Expiration, Extension} from "../newtype";

export function extractAbsoluteUrl(
    possibleUrl: string | null | undefined,
): string | null {
    if (possibleUrl == null) {
        return null;
    }

    let url: URL;
    try {
        url = new URL(possibleUrl);
    } catch (e) {
        return null;
    }

    if (url.origin.length === 0) {
        return null;
    }

    return `${url.origin}${url.pathname}`;
}

export function extractDocumentLocation({
    url,
    referrer,
}: {
    url: string | null;
    referrer: string | null;
}): string | null {
    const absoluteUrl = extractAbsoluteUrl(url);
    if (absoluteUrl != null) {
        return absoluteUrl;
    }

    const absoluteReferrer = extractAbsoluteUrl(referrer);
    if (absoluteReferrer != null) {
        return absoluteReferrer;
    }

    return null;
}

export function parseIntOr<T>(
    map: (num: number) => T,
    str: string | null,
    fallback: T,
): T {
    if (str == null) {
        return fallback;
    }
    const num = Number.parseInt(str, 10);
    return Number.isNaN(num) ? fallback : map(num);
}

export interface PageViewRequest {
    documentLocation: string;
    sessionExpiration: Expiration;
    sessionExtension: Extension;
}

export const PageViewRequest = {
    fromRequest(
        request: Request,
        {
            defaultSessionExpiration,
            defaultSessionExtension,
        }: {
            defaultSessionExpiration: Expiration;
            defaultSessionExtension: Extension;
        },
    ): PageViewRequest | null {
        const url = new URL(request.url);

        const documentLocation = extractDocumentLocation({
            url: url.searchParams.get("url"),
            referrer: request.headers.get("Referer"),
        });

        if (documentLocation == null) {
            return null;
        }

        const sessionExpiration = parseIntOr(
            Expiration,
            url.searchParams.get("expiration"),
            defaultSessionExpiration,
        );

        const sessionExtension = parseIntOr(
            Extension,
            url.searchParams.get("extension"),
            defaultSessionExtension,
        );

        return {
            documentLocation,
            sessionExpiration,
            sessionExtension,
        };
    },
};
