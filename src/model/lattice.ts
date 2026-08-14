import * as cir from '../cir'
import { TypeName } from './type-name'

export interface Lattice {
    unconstrained(): Lattice
    isSupersetTo(lattice: Lattice): boolean
    isSameType(lattice: Lattice): boolean
    toCIR(): cir.ValueSet
    toString(): string
}

export class IntegerLattice implements Lattice {
    private constructor(
        public readonly min: bigint | undefined,
        public readonly max: bigint | undefined,
    ) {}

    static unconstrained() {
        return new IntegerLattice(undefined, undefined)
    }

    static create({
        min,
        max,
    }: {
        min?: bigint
        max?: bigint
    }): IntegerLattice {
        return new IntegerLattice(min, max)
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

    isSameType(lattice: Lattice): boolean {
        return lattice instanceof IntegerLattice
    }

    toCIR(): cir.ValueSet {
        return {
            type: 'integer',
            min: this.min?.toString(),
            max: this.max?.toString(),
        }
    }

    toString(): string {
        return 'integer'
    }
}

export class TruthvalueLattice implements Lattice {
    private constructor(
        public readonly values: ('false' | 'ambiguous' | 'true')[],
    ) {}

    static create(
        values?: ('false' | 'ambiguous' | 'true')[],
    ): TruthvalueLattice {
        return new TruthvalueLattice(values ?? ['false', 'ambiguous', 'true'])
    }

    unconstrained(): Lattice {
        return TruthvalueLattice.create(['false', 'ambiguous', 'true'])
    }

    isSupersetTo(lattice: Lattice): boolean {
        return (
            lattice instanceof TruthvalueLattice &&
            lattice.values.every((v) => this.values.includes(v))
        )
    }

    isSameType(lattice: Lattice): boolean {
        return lattice instanceof TruthvalueLattice
    }

    toCIR(): cir.ValueSet {
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

    isSameType(lattice: Lattice): boolean {
        return lattice instanceof StringLattice
    }

    toCIR(): cir.ValueSet {
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

    isSameType(lattice: Lattice): boolean {
        return (
            lattice instanceof RCTypeLattice &&
            this.type.canonical() === lattice.type.canonical()
        )
    }

    toCIR(): cir.ValueSet {
        return {
            type: 'rc-type',
            typeName: this.type.name,
            namespace: this.type.namespace,
        }
    }

    toString(): string {
        return this.type.canonical()
    }
}
