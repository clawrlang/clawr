import { SourceCodeSpan } from '@/tools'
import { SemanticResult } from '@/tools/semantic-result'
import * as cir from '@clawr/cir'
import { Context, ContextWithDomain, Expression } from '.'
import { AnyIsolationLevel } from './isolation-level'
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

    isEffectivelyConst(context: Context): SemanticResult<boolean> {
        throw new Error('Method not implemented.')
    }
    isolationLevel(context: Context): SemanticResult<AnyIsolationLevel> {
        throw new Error('Method not implemented.')
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
    setCurrentValue?(context: Context, value: ValueSet): SemanticResult {
        throw new Error('Method not implemented.')
    }
}
