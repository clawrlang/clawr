import * as cir from '../cir'
import { SourceCodeSpan } from '../diagnostics'
import { Context } from '.'
import {
    Lattice,
    IntegerLattice,
    TruthvalueLattice,
    StringLattice,
    RCTypeLattice,
} from './lattice'
import { VariableSemantics } from './variable-declaration'
import { convertSemantics } from './variable-reference'
import { TypeName } from './type-name'

export interface ExplicitValueSet {
    get span(): SourceCodeSpan
    toCIR(): cir.ValueSet
    toLattice(context: Context): Lattice
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

    toCIR(): Extract<cir.ValueSet, { type: 'integer' }> {
        return {
            type: 'integer',
            min: this.min?.toString(),
            max: this.max?.toString(),
        }
    }

    toLattice(): Lattice {
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

    toCIR(): Extract<cir.ValueSet, { type: 'truthvalue' }> {
        return {
            type: 'truthvalue',
            values: this.values,
        }
    }

    toLattice(): Lattice {
        return TruthvalueLattice.create(this.values)
    }
}

export class ExplicitStringValueSet implements ExplicitValueSet {
    private constructor(public readonly span: SourceCodeSpan) {}

    static create({ span }: { span: SourceCodeSpan }): ExplicitStringValueSet {
        return new ExplicitStringValueSet(span)
    }

    toCIR(): Extract<cir.ValueSet, { type: 'string' }> {
        return { type: 'string' }
    }

    toLattice(): Lattice {
        return StringLattice.create()
    }
}

export class ExplicitRCTypeValueSet implements ExplicitValueSet {
    private constructor(
        public readonly type: TypeName,
        public readonly semantics: VariableSemantics,
        public readonly span: SourceCodeSpan,
    ) {}

    static create({
        type,
        semantics,
        span,
    }: {
        type: TypeName
        semantics: VariableSemantics
        span: SourceCodeSpan
    }): ExplicitRCTypeValueSet {
        return new ExplicitRCTypeValueSet(type, semantics, span)
    }

    toCIR(): Extract<cir.ValueSet, { type: 'rc-type' }> {
        return {
            type: 'rc-type',
            typeName: this.type.name,
            semantics: convertSemantics(this.semantics),
        }
    }

    toLattice(context: Context): Lattice {
        if (this.semantics === 'ref' || this.semantics === 'mutref')
            return RCTypeLattice.create({
                typeName: this.type.name,
                semantics: 'ISOLATED',
            })

        return RCTypeLattice.create({
            typeName: this.type.name,
            semantics: 'ISOLATED',
            fields: Object.fromEntries(
                context.scope
                    .dataDeclaration(this.type.name)
                    ?.fields.map((field) => [
                        field.name,
                        field.valueSet.toLattice(context),
                    ]) ?? [],
            ),
        })
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

    toCIR(): Extract<cir.ValueSet, { type: 'rc-type' }> {
        return {
            type: 'rc-type',
            typeName: this.typeName,
            semantics: 'ISOLATED',
        }
    }

    toLattice(context: Context): Lattice {
        return RCTypeLattice.create({
            typeName: this.typeName,
            semantics: 'UNIQUE',
            fields: Object.fromEntries(
                context.scope
                    .dataDeclaration(this.typeName)
                    ?.fields.map((field) => [
                        field.name,
                        field.valueSet.toLattice(context),
                    ]) ?? [],
            ),
        })
    }
}
