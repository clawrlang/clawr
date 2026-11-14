import { Context, Expression, Statement } from '@/model'
import { Retain } from '@/model/retain'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { Result } from '@/tools/result'
import { SemanticErrorResult, SemanticResult } from '@/tools/source-result'
import { ISOLATED } from './isolation-level'
import { IntegerSet, RealSet, StringSet, TruthvalueSet } from './value-set'

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
            context.scope.releaseThrough(context.returnScope ?? context.scope)
            context.scope.emitted.push({
                kind: 'RETURN',
            })
            return Result.ok
        }

        const collected = SemanticResult.collect([
            this.value.currentValue(context),
            this.value.isolationLevel(context),
            Retain.ifStorage(this.value, context),
        ])
        if (collected.isError) return collected
        const [type, isolationLevel, retainedValue] = collected.value

        const cirResult = retainedValue.toCIRExpression(context)
        if (cirResult.isError) return cirResult
        const retainedValueCIR = cirResult.value

        if (type instanceof StringSet) {
            const releaseStart = context.scope.emitted.length
            context.scope.releaseThrough(context.returnScope ?? context.scope)
            let returnValue = retainedValueCIR
            if (context.scope.emitted.length > releaseStart) {
                // Evaluate the value before releasing an owner it may reference.
                const temp = context.scope.nextTempVar()
                context.scope.emitted.splice(releaseStart, 0, {
                    kind: 'VARIABLE_DECL',
                    name: temp,
                    type: context.scope.toCIRType(type),
                    initialValue: retainedValueCIR,
                })
                returnValue = {
                    kind: 'VARIABLE_REF',
                    name: temp,
                    type: retainedValueCIR.type,
                }
            }
            context.scope.emitted.push({
                kind: 'RETURN',
                value: returnValue,
            })
        } else if (
            retainedValue instanceof Retain &&
            isolationLevel === ISOLATED
        ) {
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
                type: context.scope.toCIRType(type),
                initialValue: retainedValueCIR,
            })
            context.scope.releaseThrough(context.returnScope ?? context.scope)
            context.scope.emitted.push({
                kind: 'RETURN',
                value: {
                    kind: 'VARIABLE_REF',
                    name: temp,
                    type: retainedValueCIR.type,
                },
            })
        } else {
            const releaseStart = context.scope.emitted.length
            context.scope.releaseThrough(context.returnScope ?? context.scope)
            let returnValue = retainedValueCIR
            if (context.scope.emitted.length > releaseStart) {
                const temp = context.scope.nextTempVar()
                context.scope.emitted.splice(releaseStart, 0, {
                    kind: 'VARIABLE_DECL',
                    name: temp,
                    type: retainedValueCIR.type,
                    initialValue: retainedValueCIR,
                })
                returnValue = {
                    kind: 'VARIABLE_REF',
                    name: temp,
                    type: retainedValueCIR.type,
                }
            }
            context.scope.emitted.push({
                kind: 'RETURN',
                value: returnValue,
            })
        }
        return Result.ok
    }

    private validateInput(context: Context): SemanticResult {
        if (!this.value) {
            return context.calleeResult
                ? SemanticErrorResult.failure(
                      `Must return a ${context.calleeResult.type.toString()} value`,
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

        const [currentValue, isolationLevel] = collected.value
        if (!calleeResult.type.isSupersetTo(currentValue))
            return SemanticErrorResult.failure(
                'Return value type mismatch',
                this.value!.span,
            )

        // Primitive value types are ISOLATED: returning one always
        // yields an independent copy, whatever the declared result level.
        if (
            currentValue instanceof IntegerSet ||
            currentValue instanceof RealSet ||
            currentValue instanceof StringSet ||
            currentValue instanceof TruthvalueSet
        )
            return Result.ok

        return calleeResult.isolationLevel !== isolationLevel
            ? SemanticErrorResult.failure(
                  `Cannot return an ${isolationLevel} value as ${calleeResult.isolationLevel}`,
                  this.value!.span,
              )
            : Result.ok
    }
}
