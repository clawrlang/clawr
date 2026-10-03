import { SourceCodeSpan } from '@/tools'
import { Result } from '@/tools/result'
import { SemanticErrorResult, SemanticResult } from '@/tools/source-result'
import * as cir from '@clawr/cir'
import { Context, ContextWithDomain, Expression } from '.'
import { AnyIsolationLevel, ISOLATED } from './isolation-level'
import { IntegerRange, ValueSet } from './value-set'

export class Addition implements Expression {
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
    }): Addition {
        return new Addition(left, right, span)
    }

    isEffectivelyConst(_: Context): SemanticResult<boolean> {
        return Result.true
    }

    isolationLevel(_: Context): SemanticResult<AnyIsolationLevel> {
        return Result.value(ISOLATED)
    }

    domain(context: ContextWithDomain): SemanticResult<ValueSet> {
        const collected = SemanticResult.collect([
            this.left.domain(context),
            this.right.domain(context),
        ])
        if (collected.isError) return collected
        const [left, right] = collected.value
        return this.add(left, right)
    }

    currentValue(context: ContextWithDomain): SemanticResult<ValueSet> {
        const collected = SemanticResult.collect([
            this.left.currentValue(context),
            this.right.currentValue(context),
        ])
        if (collected.isError) return collected
        const [left, right] = collected.value
        return this.add(left, right)
    }

    toCIRExpression(
        context: ContextWithDomain,
    ): SemanticResult<cir.Expression> {
        throw new Error('Method not implemented.')
    }

    private add(left: ValueSet, right: ValueSet): SemanticResult<ValueSet> {
        if (!(left instanceof IntegerRange && right instanceof IntegerRange))
            return SemanticErrorResult.failure(
                `addition between ${left.toString()} and ${right.toString()} is not supported`,
                this.span,
            )
        const min =
            left.min === undefined || right.min === undefined
                ? undefined
                : left.min + right.min
        const max =
            left.max === undefined || right.max === undefined
                ? undefined
                : left.max + right.max
        return Result.value(IntegerRange.create({ min, max }))
    }
}
