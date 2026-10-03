import { SourceCodeSpan } from '@/tools'
import { Result } from '@/tools/result'
import { SemanticResult } from '@/tools/source-result'
import * as cir from '@clawr/cir'
import { Context, ContextWithDomain, Expression } from '.'
import { AnyIsolationLevel, ISOLATED } from './isolation-level'
import { ValueSet } from './value-set'

export class Comparison implements Expression {
    static readonly operators = [
        '==',
        '===',
        '!=',
        '!==',
        '<',
        '>',
        '<=',
        '>=',
    ] as const

    private constructor(
        private readonly operator: Operator,
        private readonly left: Expression,
        private readonly right: Expression,
        public readonly span: SourceCodeSpan,
    ) {}

    static create({
        operator,
        left,
        right,
        span,
    }: {
        operator: Operator
        left: Expression
        right: Expression
        span: SourceCodeSpan
    }): Comparison {
        return new Comparison(operator, left, right, span)
    }

    isEffectivelyConst(context: Context): SemanticResult<boolean> {
        return Result.true
    }

    isolationLevel(context: Context): SemanticResult<AnyIsolationLevel> {
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

type Operator = (typeof Comparison.operators)[number]
