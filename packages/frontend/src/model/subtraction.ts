import { SourceCodeSpan } from '@/tools'
import { Result } from '@/tools/result'
import { SemanticResult } from '@/tools/semantic-result'
import * as cir from '@clawr/cir'
import { Context, ContextWithDomain, Expression } from '.'
import { AnyIsolationLevel, ISOLATED } from './isolation-level'
import { ValueSet } from './value-set'

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
        return this.add(left, right)
    }

    currentValue(context: ContextWithDomain): SemanticResult<ValueSet> {
        const collected = SemanticResult.collect([
            this.minuend.currentValue(context),
            this.subtrahend.currentValue(context),
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
        throw new Error('not implemented')
    }
}
