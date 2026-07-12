import { Context } from '.'
import * as cir from '../cir'
import { SourceCodeSpan } from '../diagnostics'
import {
    Lattice,
    IntegerLattice,
    TruthvalueLattice,
    StringLattice,
    RefTypeLattice,
    CowTypeLattice,
} from './lattice'

export interface ValueSet {
    toCIR(context: { semantics: 'REF' | 'COW' }): cir.ValueSet
    unconstrained(): ValueSet
    toLattice(context: Context & { semantics: 'REF' | 'COW' }): Lattice
}

export class IntegerValueSet implements ValueSet {
    private constructor(
        public readonly min: bigint | undefined,
        public readonly max: bigint | undefined,
        public readonly span: SourceCodeSpan,
    ) {}

    static create({
        min,
        max,
        span,
    }: {
        min?: bigint
        max?: bigint
        span: SourceCodeSpan
    }): IntegerValueSet {
        return new IntegerValueSet(min, max, span)
    }

    toCIR(_: any): cir.ValueSet {
        return {
            type: 'integer',
            min: this.min?.toString(),
            max: this.max?.toString(),
        }
    }

    toLattice(_: Context): Lattice {
        return IntegerLattice.create({
            min: this.min,
            max: this.max,
        })
    }

    unconstrained(): ValueSet {
        return IntegerValueSet.create({
            min: undefined,
            max: undefined,
            span: this.span,
        })
    }
}

export class TruthValueSet implements ValueSet {
    private constructor(
        public readonly values: ('false' | 'ambiguous' | 'true')[],
        public readonly span: SourceCodeSpan,
    ) {}

    static create({
        values,
        span,
    }: {
        values?: ('false' | 'ambiguous' | 'true')[]
        span: SourceCodeSpan
    }): TruthValueSet {
        return new TruthValueSet(values ?? ['false', 'ambiguous', 'true'], span)
    }

    toCIR(_: any): cir.ValueSet {
        return {
            type: 'truthvalue',
            values: this.values,
        }
    }

    toLattice(_: Context): Lattice {
        return TruthvalueLattice.create(this.values)
    }

    unconstrained(): ValueSet {
        return TruthValueSet.create({
            values: ['false', 'ambiguous', 'true'],
            span: this.span,
        })
    }
}

export class StringValueSet implements ValueSet {
    private constructor(public readonly span: SourceCodeSpan) {}

    static create({ span }: { span: SourceCodeSpan }): StringValueSet {
        return new StringValueSet(span)
    }

    toCIR(_: any): cir.ValueSet {
        return { type: 'string' }
    }

    toLattice(_: Context): Lattice {
        return StringLattice.create()
    }

    unconstrained(): ValueSet {
        return this
    }
}

export class RCTypeValueSet implements ValueSet {
    private constructor(
        public readonly typeName: string,
        public readonly span: SourceCodeSpan,
    ) {}

    static create({
        typeName,
        span,
    }: {
        typeName: string
        span: SourceCodeSpan
    }): RCTypeValueSet {
        return new RCTypeValueSet(typeName, span)
    }

    toCIR(context: { semantics: 'REF' | 'COW' }): cir.ValueSet {
        return {
            type: 'rc-type',
            typeName: this.typeName,
            semantics: context.semantics,
        }
    }

    toLattice(context: Context & { semantics: 'REF' | 'COW' }): Lattice {
        switch (context.semantics) {
            case 'REF':
                return RefTypeLattice.create({
                    typeName: this.typeName,
                })
            case 'COW':
                return CowTypeLattice.create({
                    typeName: this.typeName,
                    fields: Object.fromEntries(
                        context.scope
                            .dataDeclaration(this.typeName)
                            ?.fields.map((field) => [
                                field.name,
                                field.valueSet.toLattice({
                                    ...context,
                                    semantics: 'COW',
                                }),
                            ]) ?? [],
                    ),
                })
        }
    }

    unconstrained(): ValueSet {
        return this
    }
}
