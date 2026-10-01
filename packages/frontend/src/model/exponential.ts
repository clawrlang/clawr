import { SourceCodeSpan } from '@/tools'
import { Result, SuccessResult } from '@/tools/result'
import { SemanticResult } from '@/tools/semantic-result'
import * as cir from '@clawr/cir'
import { Context, ContextWithDomain, Expression } from '.'
import { ISOLATED } from './isolation-level'
import { ValueSet } from './value-set'

export class Exponential implements Expression {
    private constructor(
        public readonly base: Expression,
        public readonly exponent: Expression,
        public readonly span: SourceCodeSpan,
    ) {}

    public static create({
        base,
        exponent,
        span,
    }: {
        base: Expression
        exponent: Expression
        span: SourceCodeSpan
    }): Exponential {
        return new Exponential(base, exponent, span)
    }

    isEffectivelyConst(_: Context): SuccessResult<true> {
        return Result.true
    }

    isolationLevel(_: Context): SuccessResult<ISOLATED> {
        return Result.value(ISOLATED)
    }

    domain(context: ContextWithDomain): SemanticResult<ValueSet> {
        throw new Error('Method not implemented.')
    }
    currentValue(context: ContextWithDomain): SemanticResult<ValueSet> {
        throw new Error('Method not implemented.')
    }

    toCIRExpression(
        context: ContextWithDomain,
    ): SemanticResult<cir.Expression> {
        throw new Error('Method not implemented.')
    }
}
