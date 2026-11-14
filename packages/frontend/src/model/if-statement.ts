import { Context, Expression, Statement } from '@/model'
import { TruthvalueSet } from '@/model/value-set'
import { Result } from '@/tools/result'
import { SemanticErrorResult, SemanticResult } from '@/tools/source-result'

export class IfStatement implements Statement {
    private constructor(
        public readonly condition: Expression,
        public readonly then: Statement[],
        public readonly otherwise?: Statement[],
    ) {}

    static create({
        condition,
        then,
        otherwise,
    }: {
        condition: Expression
        then: Statement[]
        otherwise?: Statement[]
    }): IfStatement {
        return new IfStatement(condition, then, otherwise)
    }

    emitStatement(context: Context): SemanticResult {
        const type = this.condition.type(context)
        if (type.isError) return type
        if (!(type.value instanceof TruthvalueSet))
            return SemanticErrorResult.failure(
                'If condition requires a truthvalue',
                this.condition.span,
            )
        const condition = this.condition.toCIRExpression(context)
        if (condition.isError) return condition

        const thenScope = context.scope.createChildScope()
        const elseScope = context.scope.createChildScope()
        const thenResult = this.emitBranch(this.then, {
            ...context,
            scope: thenScope,
        })
        if (thenResult.isError) return thenResult
        if (this.otherwise) {
            const elseResult = this.emitBranch(this.otherwise, {
                ...context,
                scope: elseScope,
            })
            if (elseResult.isError) return elseResult
        }
        context.scope.widenOuterAssignments([thenScope, elseScope])
        context.scope.emitted.push({
            kind: 'IF',
            condition: condition.value,
            then: thenScope.emitted,
            ...(this.otherwise ? { otherwise: elseScope.emitted } : {}),
        })
        return Result.ok
    }

    private emitBranch(
        statements: Statement[],
        context: Context,
    ): SemanticResult {
        const result = SemanticResult.collect(
            statements.map((statement) => statement.emitStatement(context)),
        )
        if (result.isError) return result
        context.scope.releaseVariables()
        return Result.ok
    }
}
