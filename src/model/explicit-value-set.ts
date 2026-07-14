import * as cir from '../cir'
import { SourceCodeSpan } from '../diagnostics'
import { Context } from '.'
import {
    Lattice,
    IntegerLattice,
    TruthvalueLattice,
    StringLattice,
    RefTypeLattice,
    CowTypeLattice,
} from './lattice'
import { VariableSemantics } from './variable-declaration'
import { convertSemantics } from './variable-reference'

export interface ExplicitValueSet {
    toCIR(context: { semantics: 'REF' | 'COW' }): cir.ValueSet
    toLattice(context: Context & { semantics: 'REF' | 'COW' }): Lattice
}

export class ExplicitIntegerValueSet implements ExplicitValueSet {
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
    }): ExplicitIntegerValueSet {
        return new ExplicitIntegerValueSet(min, max, span)
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
}

export class ExplicitTruthValueSet implements ExplicitValueSet {
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
    }): ExplicitTruthValueSet {
        return new ExplicitTruthValueSet(
            values ?? ['false', 'ambiguous', 'true'],
            span,
        )
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
}

export class ExplicitStringValueSet implements ExplicitValueSet {
    private constructor(public readonly span: SourceCodeSpan) {}

    static create({ span }: { span: SourceCodeSpan }): ExplicitStringValueSet {
        return new ExplicitStringValueSet(span)
    }

    toCIR(_: any): cir.ValueSet {
        return { type: 'string' }
    }

    toLattice(_: Context): Lattice {
        return StringLattice.create()
    }
}

export class ExplicitRCTypeValueSet implements ExplicitValueSet {
    private constructor(
        public readonly typeName: string,
        public readonly semantics: VariableSemantics,
        public readonly span: SourceCodeSpan,
    ) {}

    static create({
        typeName,
        semantics,
        span,
    }: {
        typeName: string
        semantics: VariableSemantics
        span: SourceCodeSpan
    }): ExplicitRCTypeValueSet {
        return new ExplicitRCTypeValueSet(typeName, semantics, span)
    }

    toCIR(_: any): cir.ValueSet {
        return {
            type: 'rc-type',
            typeName: this.typeName,
            semantics: convertSemantics(this.semantics),
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
}

export class ExplicitUniqueValueSet implements ExplicitValueSet {
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
    }): ExplicitUniqueValueSet {
        return new ExplicitUniqueValueSet(typeName, span)
    }

    toCIR(): cir.ValueSet {
        return {
            type: 'rc-type',
            typeName: this.typeName,
            semantics: 'COW',
        }
    }

    toLattice(context: Context): Lattice {
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
