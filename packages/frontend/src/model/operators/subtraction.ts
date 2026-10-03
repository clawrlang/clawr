import { Context, ContextWithDomain, Expression } from '@/model'
import { AnyIsolationLevel, ISOLATED } from '@/model/isolation-level'
import { IntegerRange, ValueSet } from '@/model/value-set'
import { SourceCodeSpan } from '@/tools'
import { Result } from '@/tools/result'
import { SemanticErrorResult, SemanticResult } from '@/tools/source-result'
import * as cir from '@clawr/cir'

export class Subtraction implements Expression {
    private constructor(
        private readonly minuend: Expression,
        private readonly subtrahend: Expression,
        public readonly span: SourceCodeSpan,
    ) {}

    static create({
        minuend,
        subtrahend,
        span,
    }: {
        minuend: Expression
        subtrahend: Expression
        span: SourceCodeSpan
    }): Subtraction {
        return new Subtraction(minuend, subtrahend, span)
    }

    isEffectivelyConst(_: Context): SemanticResult<boolean> {
        return Result.true
    }

    isolationLevel(_: Context): SemanticResult<AnyIsolationLevel> {
        return Result.value(ISOLATED)
    }

    domain(context: ContextWithDomain): SemanticResult<ValueSet> {
        const collected = SemanticResult.collect([
            this.minuend.domain(context),
            this.subtrahend.domain(context),
        ])
        if (collected.isError) return collected
        const [left, right] = collected.value
        return this.sub(left, right)
    }

    currentValue(context: ContextWithDomain): SemanticResult<ValueSet> {
        const collected = SemanticResult.collect([
            this.minuend.currentValue(context),
            this.subtrahend.currentValue(context),
        ])
        if (collected.isError) return collected
        const [left, right] = collected.value
        return this.sub(left, right)
    }

    toCIRExpression(
        context: ContextWithDomain,
    ): SemanticResult<cir.Expression> {
        throw new Error('Method not implemented.')
    }

    private sub(
        minuend: ValueSet,
        subtrahend: ValueSet,
    ): SemanticResult<ValueSet> {
        if (!(
            minuend instanceof IntegerRange &&
            subtrahend instanceof IntegerRange
        ))
            return SemanticErrorResult.failure(
                `subtraction between ${minuend.toString()} and ${subtrahend.toString()} is not supported`,
                this.span,
            )
        const min: bigint | undefined =
            minuend.min === undefined || subtrahend.max === undefined
                ? undefined
                : (((minuend.min as bigint) - subtrahend.max) as bigint)
        const max: bigint | undefined =
            minuend.max === undefined || subtrahend.min === undefined
                ? undefined
                : (((minuend.max as bigint) - subtrahend.min) as bigint)
        return Result.value(IntegerRange.create({ min, max }))
    }
}
