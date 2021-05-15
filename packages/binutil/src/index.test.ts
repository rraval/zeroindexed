import {describe, test, expect} from "@jest/globals";

import {arrayBufferToHex, randomlyInitializeBuffer, uuid4} from ".";

describe("arrayBufferToHex", () => {
    ([
        [Uint8Array.of(), ""],
        [Uint8Array.of(0x01, 0x10, 0xde, 0xad, 0xbe, 0xef), "0110deadbeef"],
    ] as const).forEach(([array, expected]) => {
        test(expected, () => {
            expect(arrayBufferToHex(array.buffer)).toBe(expected);
        });
    });
});

describe("randomlyInitializeBuffer", () => {
    test("initializes", () => {
        const buffer = new Uint8Array(16);
        expect(buffer.every((byte) => byte === 0)).toBe(true);

        randomlyInitializeBuffer(buffer);
        expect(buffer.some((byte) => byte !== 0)).toBe(true);
    });

    test("is random", () => {
        const buffer1 = new Uint8Array(16);
        const buffer2 = new Uint8Array(16);

        randomlyInitializeBuffer(buffer1);
        randomlyInitializeBuffer(buffer2);

        expect(buffer1.some((byte, index) => byte !== buffer2[index])).toBe(true);
    });
});

describe("uuid4", () => {
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    test("Matches regex", () => {
        expect(uuid4()).toMatch(regex);
    });
});
