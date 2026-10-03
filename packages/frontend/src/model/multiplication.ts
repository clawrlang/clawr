import { SourceCodeSpan } from '@/tools'
import { Result } from '@/tools/result'
import { SemanticErrorResult, SemanticResult } from '@/tools/source-result'
import * as cir from '@clawr/cir'
import { Context, ContextWithDomain, Expression } from '.'
import { AnyIsolationLevel, ISOLATED } from './isolation-level'
import { IntegerRange, ValueSet } from './value-set'

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
        return this.mul(left, right)
    }

    currentValue(context: ContextWithDomain): SemanticResult<ValueSet> {
        const collected = SemanticResult.collect([
            this.left.currentValue(context),
            this.right.currentValue(context),
        ])
        if (collected.isError) return collected
        const [left, right] = collected.value
        return this.mul(left, right)
    }

    toCIRExpression(
        context: ContextWithDomain,
    ): SemanticResult<cir.Expression> {
        throw new Error('Method not implemented.')
    }

    private mul(left: ValueSet, right: ValueSet): SemanticResult<ValueSet> {
        if (!(left instanceof IntegerRange && right instanceof IntegerRange))
            return SemanticErrorResult.failure(
                `multiplication between ${left.toString()} and ${right.toString()} is not supported`,
                this.span,
            )

        const { min, max } = integerMultiplicationRange(left, right)
        return Result.value(IntegerRange.create({ min, max }))
    }
}

// A range bound, where unboundedness is given an explicit sign so that
// infinities can be compared/multiplied correctly.
type Bound =
    | { kind: 'finite'; value: bigint }
    | { kind: 'negativeInfinity' }
    | { kind: 'positiveInfinity' }

function lowerBound(value: bigint | undefined): Bound {
    return value !== undefined
        ? { kind: 'finite', value }
        : { kind: 'negativeInfinity' }
}

function upperBound(value: bigint | undefined): Bound {
    return value !== undefined
        ? { kind: 'finite', value }
        : { kind: 'positiveInfinity' }
}

function multiplyBounds(a: Bound, b: Bound): Bound {
    if (a.kind === 'finite' && b.kind === 'finite')
        return { kind: 'finite', value: a.value * b.value }
    // 0 * infinity is mathematically indeterminate; define it as 0 so a
    // factor known to be exactly 0 always collapses the product to 0.
    if (
        (a.kind === 'finite' && a.value === 0n) ||
        (b.kind === 'finite' && b.value === 0n)
    )
        return { kind: 'finite', value: 0n }

    const sign = (bound: Bound): 1 | -1 =>
        bound.kind === 'finite'
            ? bound.value > 0n
                ? 1
                : -1
            : bound.kind === 'positiveInfinity'
              ? 1
              : -1
    return sign(a) * sign(b) > 0
        ? { kind: 'positiveInfinity' }
        : { kind: 'negativeInfinity' }
}

function minBound(a: Bound, b: Bound): Bound {
    if (a.kind === 'negativeInfinity' || b.kind === 'negativeInfinity')
        return { kind: 'negativeInfinity' }
    if (a.kind === 'positiveInfinity') return b
    if (b.kind === 'positiveInfinity') return a
    return a.value <= b.value ? a : b
}

function maxBound(a: Bound, b: Bound): Bound {
    if (a.kind === 'positiveInfinity' || b.kind === 'positiveInfinity')
        return { kind: 'positiveInfinity' }
    if (a.kind === 'negativeInfinity') return b
    if (b.kind === 'negativeInfinity') return a
    return a.value >= b.value ? a : b
}

// The product of two intervals is bounded by its four corner products,
// since multiplication by a fixed-sign factor is monotonic.
function integerMultiplicationRange(
    left: IntegerRange,
    right: IntegerRange,
): { min: bigint | undefined; max: bigint | undefined } {
    const lMin = lowerBound(left.min)
    const lMax = upperBound(left.max)
    const rMin = lowerBound(right.min)
    const rMax = upperBound(right.max)

    const corners = [
        multiplyBounds(lMin, rMin),
        multiplyBounds(lMin, rMax),
        multiplyBounds(lMax, rMin),
        multiplyBounds(lMax, rMax),
    ]

    const min = corners.reduce(minBound)
    const max = corners.reduce(maxBound)

    return {
        min: min.kind === 'finite' ? min.value : undefined,
        max: max.kind === 'finite' ? max.value : undefined,
    }
}
