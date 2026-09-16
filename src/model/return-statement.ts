import * as cir from '@/cir'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { Failable, isFailure, Result } from '@/tools/failable'
import { Context, Expression, Statement } from '.'
import { AnyIsolationLevel } from './isolation-level'
import { Lattice } from './lattice'
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

    *emitStatement(context: Context): Failable {
        const validation = yield* this.validateInput(context)
        if (isFailure(validation)) return validation
        if (!this.value || !context.calleeResult) {
            context.scope.releaseVariables()
            context.scope.emitted.push({
                kind: 'RETURN',
            })
            return Result.success
        }

        const lattice: Lattice = yield yield* this.value.currentValue(context)
        const retainedValue: Expression = yield yield* Retain.ifStorage(
            this.value,
            {
                ...context,
                ...{ isolationLevel: undefined },
            },
        )

        const retainedValueCIR: cir.Expression =
            yield yield* retainedValue.toCIRExpression(context)

        if (retainedValue instanceof Retain) {
            // && isolationLevel === ISOLATED
            const object =
                yield yield* retainedValue.value.toCIRExpression(context)
            context.scope.emitted.push({
                kind: 'ENSURE_UNIQUE',
                object,
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

    private *validateInput(context: Context): Failable {
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
        const lattice: Lattice = yield yield* this.value.currentValue(context)
        if (!calleeResult.lattice.isSupersetTo(lattice))
            yield Result.failure('Return value type mismatch', this.value!.span)

        const isolationLevel: AnyIsolationLevel =
            yield yield* this.value.isolationLevel(context)

        return calleeResult.isolationLevel !== isolationLevel
            ? Result.failure(
                  `Cannot return an ${isolationLevel} value as ${calleeResult.isolationLevel}`,
                  this.value!.span,
              )
            : Result.success
    }
}
