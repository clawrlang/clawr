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

export class RefTypeLattice implements Lattice {
    private constructor(public readonly typeName: string) {}

    static create({ typeName }: { typeName: string }): RefTypeLattice {
        return new RefTypeLattice(typeName)
    }

    unconstrained(): Lattice {
        return this
    }

    toCIR(): cir.ValueSet {
        return {
            type: 'rc-type',
            typeName: this.typeName,
            semantics: 'REF',
        }
    }
}

export class CowTypeLattice implements Lattice {
    private constructor(
        public readonly typeName: string,
        public readonly fields: Record<string, Lattice>,
    ) {}

    static create({
        typeName,
        fields,
    }: {
        typeName: string
        fields: Record<string, Lattice>
    }): CowTypeLattice {
        return new CowTypeLattice(typeName, fields)
    }

    unconstrained(): Lattice {
        return CowTypeLattice.create({
            typeName: this.typeName,
            fields: Object.fromEntries(
                Object.entries(this.fields).map(([name, field]) => [
                    name,
                    field.unconstrained(),
                ]),
            ),
        })
    }

    toCIR(): cir.ValueSet {
        return {
            type: 'rc-type',
            typeName: this.typeName,
            semantics: 'COW',
        }
    }
}

export class UniqueTypeLattice implements Lattice {
    private constructor(
        public readonly typeName: string,
        public readonly fields: Record<string, Lattice>,
    ) {}

    static create({
        typeName,
        fields,
    }: {
        typeName: string
        fields: Record<string, Lattice>
    }): UniqueTypeLattice {
        return new UniqueTypeLattice(typeName, fields)
    }

    unconstrained(): Lattice {
        return UniqueTypeLattice.create({
            typeName: this.typeName,
            fields: Object.fromEntries(
                Object.entries(this.fields).map(([name, field]) => [
                    name,
                    field.unconstrained(),
                ]),
            ),
        })
    }

    asCOW() {
        return CowTypeLattice.create({
            typeName: this.typeName,
            fields: this.fields,
        })
    }

    asREF() {
        return RefTypeLattice.create({
            typeName: this.typeName,
        })
    }

    toCIR(): cir.ValueSet {
        return {
            type: 'rc-type',
            typeName: this.typeName,
            semantics: 'COW',
        }
    }
}
