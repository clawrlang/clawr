import { Context, Expression, Statement } from '@/model'
import { UNIQUE, UNKNOWN } from '@/model/isolation-level'
import { DataLiteral } from '@/model/literals'
import { PropertyReference } from '@/model/property-reference'
import { Retain } from '@/model/retain'
import { RCTypeSet } from '@/model/value-set'
import { VariableReference } from '@/model/variable-reference'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { Result } from '@/tools/result'
import { SemanticErrorResult, SemanticResult } from '@/tools/source-result'

export class Assignment implements Statement {
    private constructor(
        public target: PropertyReference | VariableReference,
        public value: Expression,
        public span: SourceCodeSpan,
    ) {}

    static create({
        target,
        value,
        span,
    }: {
        target: PropertyReference | VariableReference
        value: Expression
        span: SourceCodeSpan
    }) {
        return new Assignment(target, value, span)
    }

    emitStatement(context: Context): SemanticResult {
        const validityResult = this.checkValidity(context)
        if (validityResult.isError) return validityResult

        const collected = SemanticResult.collect([
            this.target.isolationLevel(context),
            this.target.type(context),
        ])
        if (collected.isError) return collected

        const [targetIsolationLevel, targetType] = collected.value
        if (targetIsolationLevel === UNKNOWN)
            return SemanticErrorResult.failure(
                'Cannot assign to target parameter with UNKNOWN isolation-level',
                this.span,
            )

        const explicitTypeContext = {
            ...context,
            isolationLevel: targetIsolationLevel,
            explicitType: targetType,
        }

        const value = this.value.currentValue(explicitTypeContext)
        if (value.isError) return value
        const cirResults = this.emitCIRStatements(context)
        if (cirResults.isError) return cirResults

        if (this.value instanceof DataLiteral && this.value.initializerCall)
            this.value.initializerCall
                .withTarget(this.target)
                .emitStatement(context)

        return this.target.setCurrentValue(context, value.value)
    }

    private emitCIRStatements(context: Context): SemanticResult {
        const collectedTargetResults = SemanticResult.collect([
            this.target.isolationLevel(context),
            this.target.type(context),
            this.target.toCIRExpression(context),
        ])
        if (collectedTargetResults.isError) return collectedTargetResults
        const [targetIsolationLevel, targetType, target] =
            collectedTargetResults.value

        const explicitTypeContext = {
            ...context,
            isolationLevel: targetIsolationLevel,
            explicitType: targetType,
        }

        const collectedValueResults = SemanticResult.collect([
            this.value.isolationLevel(explicitTypeContext),
            Retain.ifStorage(this.value, context),
        ])
        if (collectedValueResults.isError) return collectedValueResults

        const [valueIsolationLevel, retainedValue] = collectedValueResults.value
        if (explicitTypeContext.isolationLevel === UNKNOWN)
            return SemanticErrorResult.failure(
                'Cannot assign to parameter with UNKNOWN isolationLevel',
                this.span,
            )

        const retainedValueCIRResult = retainedValue.toCIRExpression({
            ...explicitTypeContext,
            isolationLevel: explicitTypeContext.isolationLevel,
        })
        if (retainedValueCIRResult.isError) return retainedValueCIRResult

        const retainedValueCIR = retainedValueCIRResult.value

        const preludeResult = this.target.assignmentPrelude(context)
        if (preludeResult.isError) return preludeResult

        context.scope.emitted.push(...preludeResult.value)

        if (retainedValue instanceof Retain) {
            const tempVar = context.scope.nextTempVar()

            context.scope.emitted.push({
                kind: 'VARIABLE_DECL' as const,
                name: tempVar,
                type: targetType.toCIR(),
                initialValue: target,
            })

            context.scope.emitted.push(
                {
                    kind: 'ASSIGN',
                    target,
                    value: retainedValueCIR,
                },
                {
                    kind: 'RELEASE',
                    object: {
                        kind: 'VARIABLE_REF',
                        name: tempVar,
                    },
                },
            )
        } else if (
            targetType instanceof RCTypeSet &&
            retainedValueCIR?.kind === 'CALL' &&
            valueIsolationLevel === UNIQUE
        ) {
            context.scope.emitted.push({
                kind: 'ASSIGN',
                target,
                value: {
                    kind: 'AS_SHARED',
                    object: retainedValueCIR,
                    type: targetType.toCIR(),
                },
            })
        } else {
            context.scope.emitted.push({
                kind: 'ASSIGN',
                target,
                value: retainedValueCIR,
            })
        }
        return Result.ok
    }

    private checkValidity(context: Context): SemanticResult {
        const collected = SemanticResult.collect([
            this.target.type(context),
            this.target.isolationLevel(context),
        ])
        if (collected.isError) return collected
        const [targetType, targetIsolationLevel] = collected.value

        if (targetIsolationLevel === UNKNOWN)
            return SemanticErrorResult.failure(
                'Cannot assign to UNKNOWN isolation target',
                this.span,
            )

        const explicitTypeContext = {
            ...context,
            isolationLevel: targetIsolationLevel,
            explicitType: targetType,
        }
        const assignedValueResult = this.value.currentValue(explicitTypeContext)
        if (assignedValueResult.isError) return assignedValueResult
        const assignedValue = assignedValueResult.value
        if (!targetType.isSupersetTo(assignedValue))
            return SemanticErrorResult.failure(
                `Cannot assign value of type ${assignedValue.toString()} to target of type ${targetType.toString()}`,
                this.span,
            )
        const valueIsolationLevelResult = this.value.isolationLevel(context)
        if (valueIsolationLevelResult.isError) return valueIsolationLevelResult
        const valueIsolationLevel = valueIsolationLevelResult.value
        if (valueIsolationLevel === UNIQUE) return Result.ok
        if (valueIsolationLevel === UNKNOWN)
            return SemanticErrorResult.failure(
                'Parameter with unspecified isolation level may not be used in assignment',
                this.value.span,
            )
        if (targetIsolationLevel !== valueIsolationLevel)
            return SemanticErrorResult.failure(
                `Cannot assign ${valueIsolationLevel} value to ${targetIsolationLevel} target`,
                this.span,
            )
        return Result.ok
    }
}
