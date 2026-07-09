import * as cir from '../cir'
import { SourceCodeSpan } from '../diagnostics'

export interface ValueSet {
    toCIR(context: { semantics: 'REF' | 'COW' }): cir.ValueSet
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
}

export class StringValueSet implements ValueSet {
    private constructor(public readonly span: SourceCodeSpan) {}

    static create({ span }: { span: SourceCodeSpan }): StringValueSet {
        return new StringValueSet(span)
    }

    toCIR(_: any): cir.ValueSet {
        return {
            type: 'string',
        }
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
}
