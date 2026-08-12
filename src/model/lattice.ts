import * as cir from '../cir'
import { TypeName } from './type-name'

export interface Lattice {
    unconstrained(): Lattice
    toCIR(): cir.ValueSet
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

    toCIR(): cir.ValueSet {
        return {
            type: 'integer',
            min: this.min?.toString(),
            max: this.max?.toString(),
        }
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

    toCIR(): cir.ValueSet {
        return {
            type: 'truthvalue',
            values: this.values,
        }
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

    toCIR(): cir.ValueSet {
        return { type: 'string' }
    }
}

export class RCTypeLattice implements Lattice {
    private constructor(
        public readonly type: TypeName,
        public readonly semantics: 'ISOLATED' | 'SHARED' | 'UNIQUE',
        public readonly fields: Record<string, Lattice> | undefined,
    ) {}

    static create({
        type,
        semantics,
        fields,
    }: {
        type: TypeName
        semantics: 'ISOLATED' | 'SHARED' | 'UNIQUE'
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

    withSemantics(semantics: 'ISOLATED' | 'SHARED' | 'UNIQUE'): RCTypeLattice {
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
}
