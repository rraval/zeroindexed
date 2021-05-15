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

export function parseIntOr(str: string | null, fallback: number): number {
    if (str == null) {
        return fallback;
    }
    const num = Number.parseInt(str, 10);
    return Number.isNaN(num) ? fallback : num;
}

export interface PageViewRequest {
    documentLocation: string;
    sessionDurationSeconds: number;
}

export const PageViewRequest = {
    fromRequest(
        request: Request,
        {
            defaultSessionDurationSeconds,
        }: {
            defaultSessionDurationSeconds: number;
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

        const sessionDurationSeconds = parseIntOr(
            url.searchParams.get("duration"),
            defaultSessionDurationSeconds,
        );

        return {
            documentLocation,
            sessionDurationSeconds,
        };
    },
};
