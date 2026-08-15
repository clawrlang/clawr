import * as cir from '../cir'
import { SourceCodeSpan } from '../diagnostics'
import { Context } from '.'
import { ISOLATED, IsolationLevel } from './isolation-level'
import {
    Lattice,
    IntegerLattice,
    TruthvalueLattice,
    StringLattice,
    RCTypeLattice,
} from './lattice'
import { TypeName } from './type-name'

export interface ExplicitValueSet {
    get isolationLevel(): IsolationLevel | undefined
    get span(): SourceCodeSpan
    toCIR(): cir.ValueSet
    toLattice(context: Context): Lattice
    isValidValue(lattice: Lattice): boolean
}

export class UnspecifiedType {
    constructor(public readonly isolationLevel: IsolationLevel) {}

    static create({
        isolationLevel,
    }: {
        isolationLevel: IsolationLevel
    }): UnspecifiedType {
        return new UnspecifiedType(isolationLevel)
    }
}

export class ExplicitIntegerValueSet implements ExplicitValueSet {
    readonly isolationLevel = ISOLATED

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

    isValidValue(lattice: Lattice): boolean {
        return (
            lattice instanceof IntegerLattice &&
            (this.min === undefined ||
                (lattice.min !== undefined && lattice.min >= this.min)) &&
            (this.max === undefined ||
                (lattice.max !== undefined && lattice.max <= this.max))
        )
    }

    toLattice(): Lattice {
        return IntegerLattice.create({
            min: this.min,
            max: this.max,
        })
    }
}

export class ExplicitTruthValueSet implements ExplicitValueSet {
    readonly isolationLevel = ISOLATED

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

    isValidValue(lattice: Lattice): boolean {
        return (
            lattice instanceof TruthvalueLattice &&
            lattice.values.every((v) => this.values.includes(v))
        )
    }

    toLattice(): Lattice {
        return TruthvalueLattice.create(this.values)
    }
}

export class ExplicitStringValueSet implements ExplicitValueSet {
    readonly isolationLevel = ISOLATED

    private constructor(public readonly span: SourceCodeSpan) {}

    static create({ span }: { span: SourceCodeSpan }): ExplicitStringValueSet {
        return new ExplicitStringValueSet(span)
    }

    toCIR(): Extract<cir.ValueSet, { type: 'string' }> {
        return { type: 'string' }
    }

    isValidValue(lattice: Lattice): boolean {
        return lattice instanceof StringLattice
    }

    toLattice(): Lattice {
        return StringLattice.create()
    }
}

export class ExplicitRCTypeValueSet implements ExplicitValueSet {
    private constructor(
        public readonly type: TypeName,
        public readonly isolationLevel: IsolationLevel | undefined,
        public readonly span: SourceCodeSpan,
    ) {}

    static create({
        type,
        isolationLevel,
        span,
    }: {
        type: TypeName
        isolationLevel?: IsolationLevel
        span: SourceCodeSpan
    }): ExplicitRCTypeValueSet {
        return new ExplicitRCTypeValueSet(type, isolationLevel, span)
    }

    toCIR(): Extract<cir.ValueSet, { type: 'rc-type' }> {
        return {
            type: 'rc-type',
            typeName: this.type.name,
            namespace: this.type.namespace,
        }
    }

    isValidValue(lattice: Lattice): boolean {
        return (
            lattice instanceof RCTypeLattice &&
            lattice.type.canonical() === this.type.canonical()
        )
    }

    toLattice(context: Context): Lattice {
        return RCTypeLattice.create({
            type: this.type,
            fields: Object.fromEntries(
                context.scope
                    .dataDeclaration(this.type)
                    ?.fields.map((field) => [
                        field.name,
                        field.valueSet.toLattice(context),
                    ]) ?? [],
            ),
        })
    }
}
