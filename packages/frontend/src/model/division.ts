import { SourceCodeSpan } from '@/tools'
import { SemanticResult } from '@/tools/semantic-result'
import * as cir from '@clawr/cir'
import { Context, ContextWithDomain, Expression } from '.'
import { AnyIsolationLevel } from './isolation-level'
import { ValueSet } from './value-set'

export class Division implements Expression {
    private constructor(
        private readonly numerator: Expression,
        private readonly denominator: Expression,
        public readonly span: SourceCodeSpan,
    ) {}

    static create({
        numerator,
        denominator,
        span,
    }: {
        numerator: Expression
        denominator: Expression
        span: SourceCodeSpan
    }): Division {
        return new Division(numerator, denominator, span)
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
}
