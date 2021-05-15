import {describe, test, expect} from "@jest/globals";

import {extractAbsoluteUrl, extractDocumentLocation} from ".";

describe("extractAbsoluteUrl", () => {
    ([
        [null, null],
        [undefined, null],

        ["", null],
        ["http", null],
        ["http:", null],
        ["http://", null],
        ["/foo", null],

        ["http://host", "http://host/"],
        ["https:///host", "https://host/"],
        ["ftp://host/path", "ftp://host/path"],
    ] as const).forEach(([possibleUrl, expectedUrl]) => {
        test(`${possibleUrl}`, () => {
            expect(extractAbsoluteUrl(possibleUrl)).toBe(expectedUrl);
        });
    });
});

describe("extractDocumentLocation", () => {
    ([
        {
            url: null,
            referrer: null,
            expected: null,
        },
        {
            url: "https://blog.invalid",
            referrer: null,
            expected: "https://blog.invalid/",
        },
        {
            url: null,
            referrer: "https://blog.invalid/path",
            expected: "https://blog.invalid/path",
        },
        {
            url: "https://blog.invalid",
            referrer: "https://blog.invalid/path",
            expected: "https://blog.invalid/",
        },
    ] as const).forEach(({url, referrer, expected}) => {
        test(`${url}, ${referrer}`, () => {
            expect(extractDocumentLocation({url, referrer})).toBe(expected);
        });
    });
});
