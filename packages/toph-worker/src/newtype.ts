class Newtype<Brand, Value> {
    public readonly value: Value;

    public constructor(value: Value) {
        this.value = value;
    }

    // Also makes this class nominal
    private invariance = (brand: Brand): Brand => {
        return brand;
    };
}

export type Expiration = Newtype<"Expiration", number>;
export function Expiration(seconds: number): Expiration {
    return new Newtype(seconds);
}

export type Extension = Newtype<"Extension", number>;
export function Extension(seconds: number): Extension {
    return new Newtype(seconds);
}
