import { Context, ContextWithDomain, Expression } from '@/model'
import { AnyIsolationLevel, ISOLATED } from '@/model/isolation-level'
import { truthvalue, TruthvalueSet, ValueSet } from '@/model/value-set'
import { SourceCodeSpan } from '@/tools'
import { Result } from '@/tools/result'
import { SemanticErrorResult, SemanticResult } from '@/tools/source-result'
import * as cir from '@clawr/cir'

export class LogicalOR implements Expression {
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
    }): LogicalOR {
        return new LogicalOR(left, right, span)
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
        return this.or(left, right)
    }

    currentValue(context: ContextWithDomain): SemanticResult<ValueSet> {
        const collected = SemanticResult.collect([
            this.left.currentValue(context),
            this.right.currentValue(context),
        ])
        if (collected.isError) return collected
        const [left, right] = collected.value
        return this.or(left, right)
    }

    toCIRExpression(
        context: ContextWithDomain,
    ): SemanticResult<cir.Expression> {
        throw new Error('Method not implemented.')
    }

    private or(left: ValueSet, right: ValueSet): SemanticResult<ValueSet> {
        if (!(left instanceof TruthvalueSet && right instanceof TruthvalueSet))
            return SemanticErrorResult.failure('Not logical types', this.span)

        const canBeFalse =
            left.values.includes('false') && right.values.includes('false')
        const canBeAmbiguous =
            (left.values.includes('ambiguous') &&
                right.values.includes('ambiguous')) ||
            (left.values.includes('ambiguous') &&
                right.values.includes('false')) ||
            (left.values.includes('false') &&
                right.values.includes('ambiguous'))
        const canBeTrue =
            left.values.includes('true') || right.values.includes('true')

        const values: truthvalue[] = []
        if (canBeFalse) values.push('false')
        if (canBeAmbiguous) values.push('ambiguous')
        if (canBeTrue) values.push('true')
        return Result.value(TruthvalueSet.create(values))
    }
}
