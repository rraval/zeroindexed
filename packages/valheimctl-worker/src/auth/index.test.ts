import {describe, test, expect} from "@jest/globals";
import fc from "fast-check";
import {testProp} from "jest-fast-check";

import type {ValheimCtlConfig} from "../config";

import {decodeHttpBasicAuthorization, isAuthorized, timingSafeEquals} from ".";

describe("timingSafeEquals", () => {
    testProp("matches self", [fc.string()], (str) => timingSafeEquals(str, str));

    testProp(
        "matches ===",
        [fc.string(), fc.string()],
        (a, b) => timingSafeEquals(a, b) === (a === b),
    );
});

describe("decodeHttpBasicAuthorization", () => {
    test("undefined", () => {
        expect(decodeHttpBasicAuthorization(undefined)).toBeNull();
    });

    test("null", () => {
        expect(decodeHttpBasicAuthorization(null)).toBeNull();
    });

    test("Bearer", () => {
        expect(decodeHttpBasicAuthorization("Bearer 1234")).toBeNull();
    });

    // https://tools.ietf.org/html/rfc2617#section-2 mandates that `user-pass`
    // has a `:` character in it
    test("Basic no colon", () => {
        expect(decodeHttpBasicAuthorization("bm9jb2xvbg==")).toBeNull();
    });

    describe("Basic", () => {
        // These examples were extracted from the `Authorization` header that
        // Chromium sends
        ([
            [
                "c29tZXVzZXI6c29tZXBhc3N3b3Jk",
                {user: "someuser", password: "somepassword"},
            ],
            [
                "dXNlcjpuYW1lOnBhc3M6d29yZA==",
                {user: "user", password: "name:pass:word"},
            ],
        ] as const).forEach(([input, {user, password}]) => {
            test(input, () => {
                expect(decodeHttpBasicAuthorization(`Basic ${input}`)).toEqual({
                    user,
                    password: expect.objectContaining({
                        value: password,
                    }),
                });
            });
        });
    });
});

describe("isAuthorized", () => {
    test("true with no password", () => {
        expect(isAuthorized({password: null} as ValheimCtlConfig, null)).toBe(true);
    });

    test("false if passwords don't match", () => {
        expect(
            isAuthorized({password: "secret"} as ValheimCtlConfig, "Basic OmJsYWg="),
        ).toBe(false);
    });

    test.only("true if passwords match", () => {
        expect(
            isAuthorized(
                {password: "secret"} as ValheimCtlConfig,
                "Basic OnNlY3JldA==",
            ),
        ).toBe(true);
    });
});
