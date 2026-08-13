import * as cir from '../cir'
import { TypeName } from './type-name'
import { IsolationLevel } from '.'

export interface Lattice {
    unconstrained(): Lattice
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
        public readonly semantics: IsolationLevel,
        public readonly fields: Record<string, Lattice> | undefined,
    ) {}

    static create({
        type,
        semantics,
        fields,
    }: {
        type: TypeName
        semantics: IsolationLevel
        fields?: Record<string, Lattice>
    }): RCTypeLattice {
        return new RCTypeLattice(type, semantics, fields)
    }

    unconstrained(): Lattice {
        return RCTypeLattice.create({
            type: this.type,
            semantics: this.semantics,
            fields: Object.fromEntries(
                Object.entries(this.fields ?? {}).map(([name, field]) => [
                    name,
                    field.unconstrained(),
                ]),
            ),
        })
    }

    isSameType(lattice: Lattice): boolean {
        return (
            lattice instanceof RCTypeLattice &&
            this.type.canonical() === lattice.type.canonical()
        )
    }

    withSemantics(semantics: IsolationLevel): RCTypeLattice {
        return RCTypeLattice.create({
            type: this.type,
            semantics,
            fields: this.fields,
        })
    }

    asUNIQUE(): RCTypeLattice {
        return this.withSemantics('UNIQUE')
    }

    toCIR(): cir.ValueSet {
        return {
            type: 'rc-type',
            typeName: this.type.name,
            namespace: this.type.namespace,
            semantics:
                this.semantics === 'UNIQUE' ? 'ISOLATED' : this.semantics,
        }
    }

    toString(): string {
        return `rc-type(${this.type.canonical()}, ${this.semantics})`
    }
}
