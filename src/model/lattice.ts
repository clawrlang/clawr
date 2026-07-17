import * as cir from '../cir'

export interface Lattice {
    unconstrained(): Lattice
    asUNIQUE(): Lattice
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

    asUNIQUE(): Lattice {
        return this
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

    asUNIQUE(): Lattice {
        return this
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

    asUNIQUE(): Lattice {
        return this
    }

    unconstrained(): Lattice {
        return this
    }

    toCIR(): cir.ValueSet {
        return { type: 'string' }
    }
}

export class SharedTypeLattice implements Lattice {
    private constructor(public readonly typeName: string) {}

    static create({ typeName }: { typeName: string }): SharedTypeLattice {
        return new SharedTypeLattice(typeName)
    }

    unconstrained(): Lattice {
        return this
    }

    asUNIQUE(): UniqueTypeLattice {
        return UniqueTypeLattice.create({
            typeName: this.typeName,
            fields: {},
        })
    }

    toCIR(): cir.ValueSet {
        return {
            type: 'rc-type',
            typeName: this.typeName,
            semantics: 'SHARED',
        }
    }
}

export class IsolatedTypeLattice implements Lattice {
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
    }): IsolatedTypeLattice {
        return new IsolatedTypeLattice(typeName, fields)
    }

    unconstrained(): Lattice {
        return IsolatedTypeLattice.create({
            typeName: this.typeName,
            fields: Object.fromEntries(
                Object.entries(this.fields).map(([name, field]) => [
                    name,
                    field.unconstrained(),
                ]),
            ),
        })
    }

    asUNIQUE(): UniqueTypeLattice {
        return UniqueTypeLattice.create({
            typeName: this.typeName,
            fields: this.fields,
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
        return IsolatedTypeLattice.create({
            typeName: this.typeName,
            fields: this.fields,
        })
    }

    asREF() {
        return SharedTypeLattice.create({
            typeName: this.typeName,
        })
    }

    asUNIQUE(): Lattice {
        return this
    }

    toCIR(): cir.ValueSet {
        return {
            type: 'rc-type',
            typeName: this.typeName,
            semantics: 'ISOLATED',
        }
    }
}
