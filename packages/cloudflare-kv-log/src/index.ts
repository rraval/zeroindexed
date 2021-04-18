import {uuid} from "@cfworker/uuid";

export interface Entry {
    instant: number;
    message: string;
}

interface ScannedKey {
    instant: number;
    key: string;
}

function isObject(thing: unknown): thing is Record<string, unknown> {
    return thing != null && typeof thing === "object";
}

export class Persistence {
    private readonly kv: KVNamespace;
    private readonly prefix: string;
    private readonly ttl: number;

    public constructor({
        kv,
        prefix,
        ttl,
    }: {
        kv: KVNamespace;
        prefix: string;
        ttl: number;
    }) {
        this.kv = kv;
        this.prefix = prefix;
        this.ttl = ttl;
    }

    public async push(entry: Entry): Promise<Entry> {
        const id = uuid();
        await this.kv.put(`${this.prefix}${id}`, entry.message, {
            expirationTtl: this.ttl,
            metadata: {instant: entry.instant},
        });
        return entry;
    }

    public async getMessage(key: string): Promise<string> {
        const message = await this.kv.get(key, "text");
        if (message == null) {
            throw new Error(`${key} has a null message`);
        }
        return message;
    }

    public async scanKeys({
        allowIncomplete,
    }: {
        allowIncomplete: boolean;
    }): Promise<Array<ScannedKey>> {
        const result = await this.kv.list({prefix: this.prefix});

        if (!allowIncomplete && !result.list_complete) {
            throw new Error(
                `More than ${result.keys.length} keys present, cursor: ${result.cursor}`,
            );
        }

        return result.keys.map(({name, metadata}) => {
            if (!isObject(metadata)) {
                throw new Error(`${name} has non-object metadata`);
            }

            const instant = metadata["instant"];
            if (typeof instant !== "number") {
                throw new Error(`${name} has non-number instant`);
            }

            return {
                key: name,
                instant,
            };
        });
    }
}

export class Logger {
    public constructor(private readonly persistence: Persistence) {}

    public log(message: string): Promise<Entry> {
        const instant = Date.now();
        const entry = {instant, message};
        return this.persistence.push(entry);
    }

    public oldest(): Promise<Array<Entry>> {
        return this.entries((a, b) => a.instant - b.instant);
    }

    public newest(): Promise<Array<Entry>> {
        return this.entries((a, b) => b.instant - a.instant);
    }

    private async entries(order: (a: ScannedKey, b: ScannedKey) => number): Promise<Array<Entry>> {
        const keys = await this.persistence.scanKeys({
            // We cannot guarantee anything about ordering unless we are dealing
            // with all the keys.
            allowIncomplete: false,
        });
        keys.sort(order);

        return await Promise.all(
            keys.map(async ({instant, key}) => {
                const message = await this.persistence.getMessage(key);
                return {
                    instant,
                    message,
                };
            }),
        );
    }
}
