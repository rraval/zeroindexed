import {Entry, Persistence, ScannedKey} from "./persistence";

export type {Entry};

export class Logger {
    private readonly persistence: Persistence;

    public constructor({
        kv,
        prefix,
        ttl,
    }: {
        kv: KVNamespace;
        prefix: string;
        ttl: number;
    }) {
        this.persistence = new Persistence({kv, prefix, ttl});
    }

    public push(entry: Entry): Promise<Entry> {
        return this.persistence.push(entry);
    }

    public log(message: string): Promise<Entry> {
        return this.push({
            instant: Date.now(),
            message,
        });
    }

    public oldest(): Promise<Array<Entry>> {
        return this.entries((a, b) => a.instant - b.instant);
    }

    public newest(): Promise<Array<Entry>> {
        return this.entries((a, b) => b.instant - a.instant);
    }

    private async entries(
        order: (a: ScannedKey, b: ScannedKey) => number,
    ): Promise<Array<Entry>> {
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
