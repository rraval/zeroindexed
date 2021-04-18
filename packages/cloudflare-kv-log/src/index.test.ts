import * as crypto from "crypto";

import {jest} from "@jest/globals";
import fc from "fast-check";
import {testProp} from "jest-fast-check";

import {Entry, Logger, Persistence} from ".";

// This module is distributed as ESM and jest has trouble with modules:
// https://jestjs.io/docs/ecmascript-modules
jest.mock("@cfworker/uuid", () => {
    return {
        uuid: () => crypto.randomBytes(16).toString("hex"),
    };
});

const arbitraryEntries = fc.array(fc.string()).map((messages) => {
    return messages.map(
        (message, index): Entry => {
            return {
                instant: index,
                message,
            };
        },
    );
});

const arbitraryOriginalAndShuffledEntries = arbitraryEntries.chain(
    (originalEntries) => {
        return fc.record({
            originalEntries: fc.constant(originalEntries),
            shuffledEntries: fc.shuffledSubarray(originalEntries, {
                minLength: originalEntries.length,
                maxLength: originalEntries.length,
            }),
        });
    },
);

testProp(
    "read your writes",
    [arbitraryOriginalAndShuffledEntries, fc.string()],
    async ({originalEntries, shuffledEntries}, prefix) => {
        const persistence = new Persistence({
            kv: new FakeKV(),
            prefix,
            ttl: 1000,
        });
        const logger = new Logger(persistence);

        for (const {instant, message} of shuffledEntries) {
            persistence.push({
                instant,
                message,
            });
        }

        const actualEntries = await logger.oldest();
        if (originalEntries.length !== actualEntries.length) {
            return false;
        }

        for (let i = 0; i < originalEntries.length; ++i) {
            const original = originalEntries[i];
            const actual = actualEntries[i];
            if (
                original.instant !== actual.instant ||
                original.message !== actual.message
            ) {
                return false;
            }
        }

        return true;
    },
);

class FakeKV implements KVNamespace {
    private readonly impl: Map<
        string,
        {
            value: string;
            metadata?: Record<string, unknown>;
        }
    > = new Map();

    public put(
        key: string,
        value: string,
        {
            metadata,
        }: {
            metadata?: Record<string, unknown>;
        },
    ): Promise<void> {
        this.impl.set(key, {
            value,
            metadata,
        });
        return Promise.resolve();
    }

    public get(key: string): KVValue<string>;
    public get(key: string, type: "text"): KVValue<string>;
    public get<ExpectedValue = unknown>(
        key: string,
        type: "json",
    ): KVValue<ExpectedValue>;
    public get(key: string, type: "arrayBuffer"): KVValue<ArrayBuffer>;
    public get(key: string, type: "stream"): KVValue<ReadableStream>;
    public get(key: string, type?: string): KVValue<unknown> {
        if (type !== "text") {
            throw new Error(`Unsupported type: ${type}`);
        }

        const lookup = this.impl.get(key);
        if (lookup == null) {
            return Promise.resolve(null);
        }

        return Promise.resolve(lookup.value);
    }

    public list(_?: {
        prefix?: string;
        limit?: number;
        cursor?: string;
    }): Promise<{
        keys: Array<{name: string; expiration?: number; metadata?: unknown}>;
        list_complete: boolean;
        cursor?: string;
    }> {
        const out: Array<{name: string; metadata: unknown}> = [];

        for (const [key, lookup] of this.impl.entries()) {
            out.push({
                name: key,
                metadata: lookup.metadata,
            });
        }

        return Promise.resolve({
            keys: out,
            list_complete: true,
        });
    }

    public getWithMetadata(..._: Array<unknown>): never {
        throw new Error("getWithMetadata is unimplemented");
    }

    public delete(..._: Array<unknown>): never {
        throw new Error("delete is unimplemented");
    }
}
