import { SourceCodeSpan } from '@/tools/diagnostics'
import { Result } from '@/tools/result'
import { SemanticErrorResult, SemanticResult } from '@/tools/semantic-result'
import { Context, Expression, Statement } from '.'
import { Retain } from './retain'

export class ReturnStatement implements Statement {
    private constructor(
        public readonly value: Expression | undefined,
        public readonly span: SourceCodeSpan,
    ) {}

    static create({
        value,
        span,
    }: {
        value?: Expression
        span: SourceCodeSpan
    }): ReturnStatement {
        return new ReturnStatement(value, span)
    }

    emitStatement(context: Context): SemanticResult {
        const validationResult = this.validateInput(context)
        if (validationResult.isError) return validationResult

        if (!this.value || !context.calleeResult) {
            context.scope.releaseVariables()
            context.scope.emitted.push({
                kind: 'RETURN',
            })
            return Result.ok
        }

        const collected = SemanticResult.collect([
            this.value.currentValue(context),
            Retain.ifStorage(this.value, context),
        ])
        if (collected.isError) return collected
        const [lattice, retainedValue] = collected.value

        const cirResult = retainedValue.toCIRExpression(context)
        if (cirResult.isError) return cirResult
        const retainedValueCIR = cirResult.value

        if (retainedValue instanceof Retain) {
            // && isolationLevel === ISOLATED
            const objectResult = retainedValue.value.toCIRExpression(context)
            if (objectResult.isError) return objectResult
            context.scope.emitted.push({
                kind: 'ENSURE_UNIQUE',
                object: objectResult.value,
            })
            const temp = context.scope.nextTempVar()
            context.scope.emitted.push({
                kind: 'VARIABLE_DECL',
                name: temp,
                lattice: lattice.toCIR(),
                initialValue: retainedValueCIR,
            })
            context.scope.releaseVariables()
            context.scope.emitted.push({
                kind: 'RETURN',
                value: {
                    kind: 'VARIABLE_REF',
                    name: temp,
                    value: retainedValueCIR.value,
                },
            })
        } else {
            context.scope.releaseVariables()
            context.scope.emitted.push({
                kind: 'RETURN',
                value: retainedValueCIR,
            })
        }
        return Result.ok
    }

    private validateInput(context: Context): SemanticResult {
        if (!this.value) {
            return context.calleeResult
                ? SemanticErrorResult.failure(
                      `Must return a ${context.calleeResult.lattice.toString()} value`,
                      this.span,
                  )
                : Result.ok
        }

        const calleeResult = context.calleeResult
        if (!calleeResult)
            return SemanticErrorResult.failure(
                'Called function has no return value',
                this.value!.span,
            )
        const collected = SemanticResult.collect([
            this.value.currentValue(context),
            this.value.isolationLevel(context),
        ])
        if (collected.isError) return collected

        const [lattice, isolationLevel] = collected.value
        if (!calleeResult.lattice.isSupersetTo(lattice))
            return SemanticErrorResult.failure(
                'Return value type mismatch',
                this.value!.span,
            )

        return calleeResult.isolationLevel !== isolationLevel
            ? SemanticErrorResult.failure(
                  `Cannot return an ${isolationLevel} value as ${calleeResult.isolationLevel}`,
                  this.value!.span,
              )
            : Result.ok
    }
}
