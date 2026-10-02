import { SourceCodeSpan } from '@/tools'
import { SemanticResult } from '@/tools/semantic-result'
import * as cir from '@clawr/cir'
import { Context, ContextWithDomain, Expression } from '.'
import { AnyIsolationLevel } from './isolation-level'
import { ValueSet } from './value-set'

export class Multiplication implements Expression {
    private constructor(
        private readonly left: Expression,
        private readonly right: Expression,
        public readonly span: SourceCodeSpan,
    ) {}

    static create({
        left,
        right,
        span,
    }: {
        left: Expression
        right: Expression
        span: SourceCodeSpan
    }): Multiplication {
        return new Multiplication(left, right, span)
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
