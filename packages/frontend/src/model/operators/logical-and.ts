import { Context, ContextWithDomain, Expression } from '@/model'
import { SourceCodeSpan } from '@/tools'
import { Result } from '@/tools/result'
import { SemanticResult } from '@/tools/source-result'
import * as cir from '@clawr/cir'
import { AnyIsolationLevel, ISOLATED } from '../isolation-level'
import { ValueSet } from '../value-set'

export class LogicalAND implements Expression {
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
    }): LogicalAND {
        return new LogicalAND(left, right, span)
    }

    isEffectivelyConst(_: Context): SemanticResult<boolean> {
        return Result.true
    }

    isolationLevel(_: Context): SemanticResult<AnyIsolationLevel> {
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
