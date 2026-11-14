import { Context, Expression, Statement } from '@/model'
import { TruthvalueSet } from '@/model/value-set'
import { Result } from '@/tools/result'
import { SemanticErrorResult, SemanticResult } from '@/tools/source-result'

export class LoopStatement implements Statement {
    private constructor(
        public readonly condition: Expression,
        public readonly body: Statement[],
        public readonly testAfter: boolean,
    ) {}

    static create({
        condition,
        body,
        testAfter,
    }: {
        condition: Expression
        body: Statement[]
        testAfter: boolean
    }): LoopStatement {
        return new LoopStatement(condition, body, testAfter)
    }

    emitStatement(context: Context): SemanticResult {
        const loopScope = context.scope.createLoopScope()
        const loopContext = { ...context, scope: loopScope }
        const type = this.condition.type(loopContext)
        if (type.isError) return type
        if (!(type.value instanceof TruthvalueSet))
            return SemanticErrorResult.failure(
                'Loop condition requires a truthvalue',
                this.condition.span,
            )
        const condition = this.condition.toCIRExpression(loopContext)
        if (condition.isError) return condition

        const bodyScope = loopScope.createChildScope()
        const bodyContext = { ...context, scope: bodyScope }
        const result = SemanticResult.collect(
            this.body.map((statement) => statement.emitStatement(bodyContext)),
        )
        if (result.isError) return result
        bodyScope.releaseVariables()
        loopScope.widenOuterAssignments([bodyScope])
        context.scope.widenOuterAssignments([loopScope])
        context.scope.emitted.push({
            kind: 'LOOP',
            condition: condition.value,
            body: bodyScope.emitted,
            testAfter: this.testAfter,
        })
        return Result.ok
    }
}
