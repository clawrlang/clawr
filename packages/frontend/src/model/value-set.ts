import { TypeName } from '@/model/type-name'
import * as cir from '@clawr/cir'

export interface ValueSet {
    unconstrained(): ValueSet
    isSupersetTo(other: ValueSet): boolean
    toCIR(): cir.ValueSet
    toString(): string
}

export class IntegerSet<
    Min extends bigint | undefined = bigint | undefined,
    Max extends bigint | undefined = bigint | undefined,
> implements ValueSet {
    private constructor(
        public readonly min: Min,
        public readonly max: Max,
    ) {}

    static unconstrained() {
        return new IntegerSet(undefined, undefined)
    }

    static singleton<Value extends bigint>(v: Value) {
        return new IntegerSet(v, v)
    }

    static range<
        Min extends bigint | undefined,
        Max extends bigint | undefined,
    >({ min, max }: { min?: Min; max?: Max }) {
        return new IntegerSet<Min, Max>(min as Min, max as Max)
    }

    unconstrained(): ValueSet {
        return IntegerSet.range({ min: undefined, max: undefined })
    }

    isSupersetTo(other: ValueSet): boolean {
        return (
            other instanceof IntegerSet &&
            (this.min === undefined ||
                (other.min !== undefined && other.min >= this.min)) &&
            (this.max === undefined ||
                (other.max !== undefined && other.max <= this.max))
        )
    }

    toCIR(): cir.ValueSet & { type: 'integer' } {
        if (this.min !== undefined && (this.min as bigint) === this.max)
            return {
                type: 'integer' as const,
                value: this.min.toString() as any,
            }
        return {
            type: 'integer' as const,
            min: this.min?.toString() as any,
            max: this.max?.toString() as any,
        }
    }

    toString(): string {
        return 'integer'
    }
}

export type truthvalue = 'false' | 'ambiguous' | 'true'
export class TruthvalueSet<Values extends truthvalue[]> implements ValueSet {
    private constructor(public readonly values: Values) {}

    static unconstrained(): TruthvalueSet<['false', 'ambiguous', 'true']> {
        return this.create(['false', 'ambiguous', 'true'])
    }

    static singleton<Value extends truthvalue>(value: Value) {
        return new TruthvalueSet<[Value]>([value])
    }

    static create<Values extends truthvalue[]>(values: Values) {
        return new TruthvalueSet(values)
    }

    unconstrained(): TruthvalueSet<['false', 'ambiguous', 'true']> {
        return TruthvalueSet.create(['false', 'ambiguous', 'true'])
    }

    isSupersetTo(other: ValueSet): boolean {
        return (
            other instanceof TruthvalueSet &&
            (other.values as truthvalue[]).every((v) => this.values.includes(v))
        )
    }

    toCIR(): cir.ValueSet & { type: 'truthvalue' } {
        return this.values.length === 1
            ? {
                  type: 'truthvalue',
                  value: this.values[0],
              }
            : {
                  type: 'truthvalue',
                  values: this.values,
              }
    }

    toString(): string {
        return 'truthvalue'
    }
}

export class StringSet implements ValueSet {
    private constructor() {}

    static create(): StringSet {
        return new StringSet()
    }

    unconstrained(): StringSet {
        return this
    }

    isSupersetTo(other: ValueSet): boolean {
        return other instanceof StringSet
    }

    toCIR(): cir.ValueSet & { type: 'string' } {
        return { type: 'string' }
    }

    toString(): string {
        return 'string'
    }
}

export class RCTypeSet implements ValueSet {
    private constructor(
        public readonly type: TypeName,
        public readonly properties: Record<string, ValueSet> | undefined,
    ) {}

    static create({
        type,
        properties,
    }: {
        type: TypeName
        properties?: Record<string, ValueSet>
    }): RCTypeSet {
        return new RCTypeSet(type, properties)
    }

    unconstrained(): RCTypeSet {
        return RCTypeSet.create({
            type: this.type,
            properties: Object.fromEntries(
                Object.entries(this.properties ?? {}).map(
                    ([name, property]) => [name, property.unconstrained()],
                ),
            ),
        })
    }

    isSupersetTo(other: ValueSet): boolean {
        return (
            other instanceof RCTypeSet &&
            this.type.canonical() === other.type.canonical()
        )
    }

    toCIR(): cir.ValueSet & { type: 'rc-type' } {
        return {
            type: 'rc-type',
            name: this.type.name,
            namespace: this.type.namespace,
        }
    }

    toString(): string {
        return this.type.canonical()
    }
}
