declare global {
    export const crypto:
        | undefined
        | {
              getRandomValues?: (buffer: Uint8Array) => void;
              randomFillSync?: (buffer: Uint8Array) => void;
          };
}

const byteToHex: ReadonlyArray<string> = (() => {
    const out: Array<string> = [];
    for (let i = 0; i < 256; ++i) {
        out.push((i + 0x100).toString(16).substr(1));
    }
    return out;
})();

export function arrayBufferToHex(buffer: ArrayBuffer): string {
    let out = "";
    new Uint8Array(buffer).forEach((byte) => (out += byteToHex[byte]));
    return out;
}

export function randomlyInitializeBuffer(buffer: Uint8Array): void {
    if (crypto == null) {
        throw new Error("crypto not defined");
    }

    if (crypto.getRandomValues != null) {
        crypto.getRandomValues(buffer);
    } else if (crypto.randomFillSync != null) {
        crypto.randomFillSync(buffer);
    } else {
        throw new Error("No random bytes provider found in crypto");
    }
}

// Based on https://github.com/cfworker/cfworker/blob/master/packages/uuid/src/index.ts
// But they distribute that package as a module, which jest has trouble with, so
// just fork things into our own package with explicit runtime targets.
export const uuid4: () => string = (() => {
    const arr = new Uint8Array(16);
    const separator = "-";

    return (): string => {
        randomlyInitializeBuffer(arr);

        // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`
        arr[6] = (arr[6] & 0x0f) | 0x40;
        arr[8] = (arr[8] & 0x3f) | 0x80;

        return (
            byteToHex[arr[0]] +
            byteToHex[arr[1]] +
            byteToHex[arr[2]] +
            byteToHex[arr[3]] +
            separator +
            byteToHex[arr[4]] +
            byteToHex[arr[5]] +
            separator +
            byteToHex[arr[6]] +
            byteToHex[arr[7]] +
            separator +
            byteToHex[arr[8]] +
            byteToHex[arr[9]] +
            separator +
            byteToHex[arr[10]] +
            byteToHex[arr[11]] +
            byteToHex[arr[12]] +
            byteToHex[arr[13]] +
            byteToHex[arr[14]] +
            byteToHex[arr[15]]
        ).toLowerCase(); // https://bugs.chromium.org/p/v8/issues/detail?id=3175#c4 https://github.com/uuidjs/uuid/pull/434
    };
})();
