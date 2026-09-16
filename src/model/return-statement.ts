import { SourceCodeSpan } from '@/tools/diagnostics'
import { isFailure, Result } from '@/tools/failable'
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

    emitStatement(context: Context): Result {
        const validationResult = this.validateInput(context)
        if (isFailure(validationResult)) return validationResult

        if (!this.value || !context.calleeResult) {
            context.scope.releaseVariables()
            context.scope.emitted.push({
                kind: 'RETURN',
            })
            return Result.success
        }

        const collected = Result.collect([
            this.value.currentValue(context),
            Retain.ifStorage(this.value, context),
        ])
        if (isFailure(collected)) return collected
        const [lattice, retainedValue] = collected.value

        const cirResult = retainedValue.toCIRExpression(context)
        if (isFailure(cirResult)) return cirResult
        const retainedValueCIR = cirResult.value

        if (retainedValue instanceof Retain) {
            // && isolationLevel === ISOLATED
            const objectResult = retainedValue.value.toCIRExpression(context)
            if (isFailure(objectResult)) return objectResult
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
        return Result.success
    }

    private validateInput(context: Context): Result {
        if (!this.value) {
            return context.calleeResult
                ? Result.failure(
                      `Must return a ${context.calleeResult.lattice.toString()} value`,
                      this.span,
                  )
                : Result.success
        }

        const calleeResult = context.calleeResult
        if (!calleeResult)
            return Result.failure(
                'Called function has no return value',
                this.value!.span,
            )
        const collected = Result.collect([
            this.value.currentValue(context),
            this.value.isolationLevel(context),
        ])
        if (isFailure(collected)) return collected

        const [lattice, isolationLevel] = collected.value
        if (!calleeResult.lattice.isSupersetTo(lattice))
            return Result.failure(
                'Return value type mismatch',
                this.value!.span,
            )

        return calleeResult.isolationLevel !== isolationLevel
            ? Result.failure(
                  `Cannot return an ${isolationLevel} value as ${calleeResult.isolationLevel}`,
                  this.value!.span,
              )
            : Result.success
    }
}
