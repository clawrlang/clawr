import * as cir from '@/cir'
import { TypeName } from './type-name'

export interface Lattice {
    unconstrained(): Lattice
    isSupersetTo(lattice: Lattice): boolean
    toCIR(): cir.Lattice
    toString(): string
}

export class IntegerLattice<
    Min extends bigint | undefined,
    Max extends bigint | undefined,
> implements Lattice {
    private constructor(
        public readonly min: Min,
        public readonly max: Max,
    ) {}

    static unconstrained() {
        return new IntegerLattice(undefined, undefined)
    }

    static singleton<Value extends bigint>(v: Value) {
        return new IntegerLattice(v, v)
    }

    static create<
        Min extends bigint | undefined,
        Max extends bigint | undefined,
    >({ min, max }: { min?: Min; max?: Max }) {
        return new IntegerLattice<Min, Max>(min as Min, max as Max)
    }

    unconstrained(): Lattice {
        return IntegerLattice.create({ min: undefined, max: undefined })
    }

    isSupersetTo(lattice: Lattice): boolean {
        return (
            lattice instanceof IntegerLattice &&
            (this.min === undefined ||
                (lattice.min !== undefined && lattice.min >= this.min)) &&
            (this.max === undefined ||
                (lattice.max !== undefined && lattice.max <= this.max))
        )
    }

    toCIR(): cir.Lattice & { type: 'integer' } {
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
export class TruthvalueLattice<Values extends truthvalue[]> implements Lattice {
    private constructor(public readonly values: Values) {}

    static unconstrained() {
        return this.create(['false', 'ambiguous', 'true'])
    }

    static singleton<Value extends truthvalue>(value: Value) {
        return new TruthvalueLattice<[Value]>([value])
    }

    static create<Values extends truthvalue[]>(values: Values) {
        return new TruthvalueLattice(values)
    }

    unconstrained(): Lattice {
        return TruthvalueLattice.create(['false', 'ambiguous', 'true'])
    }

    isSupersetTo(lattice: Lattice): boolean {
        return (
            lattice instanceof TruthvalueLattice &&
            (lattice.values as truthvalue[]).every((v) =>
                this.values.includes(v),
            )
        )
    }

    toCIR(): cir.Lattice & { type: 'truthvalue'; values: Values } {
        return {
            type: 'truthvalue',
            values: this.values,
        }
    }

    toString(): string {
        return 'truthvalue'
    }
}

export class StringLattice implements Lattice {
    private constructor() {}

    static create(): StringLattice {
        return new StringLattice()
    }

    unconstrained(): Lattice {
        return this
    }

    isSupersetTo(lattice: Lattice): boolean {
        return lattice instanceof StringLattice
    }

    toCIR(): cir.Lattice & { type: 'string' } {
        return { type: 'string' }
    }

    toString(): string {
        return 'string'
    }
}

export class RCTypeLattice implements Lattice {
    private constructor(
        public readonly type: TypeName,
        public readonly fields: Record<string, Lattice> | undefined,
    ) {}

    static create({
        type,
        fields,
    }: {
        type: TypeName
        fields?: Record<string, Lattice>
    }): RCTypeLattice {
        return new RCTypeLattice(type, fields)
    }

    unconstrained(): Lattice {
        return RCTypeLattice.create({
            type: this.type,
            fields: Object.fromEntries(
                Object.entries(this.fields ?? {}).map(([name, field]) => [
                    name,
                    field.unconstrained(),
                ]),
            ),
        })
    }

    isSupersetTo(lattice: Lattice): boolean {
        return (
            lattice instanceof RCTypeLattice &&
            this.type.canonical() === lattice.type.canonical()
        )
    }

    toCIR(): cir.Lattice & { type: 'rc-type' } {
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
