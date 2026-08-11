import * as cir from '../cir'

export interface Lattice {
    unconstrained(): Lattice
    toCIR(): cir.ValueSet
}

export class IntegerLattice implements Lattice {
    private constructor(
        public readonly min: bigint | undefined,
        public readonly max: bigint | undefined,
    ) {}

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
        public readonly typeName: string,
        public readonly semantics: 'ISOLATED' | 'SHARED' | 'UNIQUE',
        public readonly fields: Record<string, Lattice> | undefined,
    ) {}

    static create({
        typeName,
        semantics,
        fields,
    }: {
        typeName: string
        semantics: 'ISOLATED' | 'SHARED' | 'UNIQUE'
        fields?: Record<string, Lattice>
    }): RCTypeLattice {
        return new RCTypeLattice(typeName, semantics, fields)
    }

    unconstrained(): Lattice {
        return RCTypeLattice.create({
            typeName: this.typeName,
            semantics: this.semantics,
            fields: Object.fromEntries(
                Object.entries(this.fields ?? {}).map(([name, field]) => [
                    name,
                    field.unconstrained(),
                ]),
            ),
        })
    }

    asUNIQUE(): RCTypeLattice {
        return RCTypeLattice.create({
            typeName: this.typeName,
            semantics: 'UNIQUE',
            fields: this.fields || {},
        })
    }

    toCIR(): cir.ValueSet {
        return {
            type: 'rc-type',
            typeName: this.typeName,
            semantics: 'ISOLATED',
        }
    }
}
