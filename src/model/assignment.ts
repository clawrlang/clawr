import { SourceCodeSpan } from '@/tools/diagnostics'
import { Result } from '@/tools/result'
import { SemanticErrorResult, SemanticResult } from '@/tools/semantic-result'
import { Context, Expression, Statement } from '.'
import { DataLiteral } from './data-literal'
import { FieldReference } from './field-reference'
import { UNIQUE, UNKNOWN } from './isolation-level'
import { Retain } from './retain'
import { RCTypeSet } from './value-set'
import { VariableReference } from './variable-reference'

export class Assignment implements Statement {
    private constructor(
        public target: FieldReference | VariableReference,
        public value: Expression,
        public span: SourceCodeSpan,
    ) {}

    static create({
        target,
        value,
        span,
    }: {
        target: FieldReference | VariableReference
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
            this.target.domain(context),
        ])
        if (collected.isError) return collected

        const [targetIsolationLevel, targetDomain] = collected.value
        if (targetIsolationLevel === UNKNOWN)
            return SemanticErrorResult.failure(
                'Cannot assign to target parameter with UNKNOWN isolation-level',
                this.span,
            )

        const explicitDomainContext = {
            ...context,
            isolationLevel: targetIsolationLevel,
            explicitDomain: targetDomain,
        }

        const value = this.value.currentValue(explicitDomainContext)
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
            this.target.domain(context),
            this.target.toCIRExpression(context),
        ])
        if (collectedTargetResults.isError) return collectedTargetResults
        const [targetIsolationLevel, targetDomain, target] =
            collectedTargetResults.value

        const explicitDomainContext = {
            ...context,
            isolationLevel: targetIsolationLevel,
            explicitDomain: targetDomain,
        }

        const collectedValueResults = SemanticResult.collect([
            this.value.isolationLevel(explicitDomainContext),
            Retain.ifStorage(this.value, context),
        ])
        if (collectedValueResults.isError) return collectedValueResults

        const [valueIsolationLevel, retainedValue] = collectedValueResults.value
        if (explicitDomainContext.isolationLevel === UNKNOWN)
            return SemanticErrorResult.failure(
                'Cannot assign to parameter with UNKNOWN isolationLevel',
                this.span,
            )

        const retainedValueCIRResult = retainedValue.toCIRExpression({
            ...explicitDomainContext,
            isolationLevel: explicitDomainContext.isolationLevel,
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
                domain: targetDomain.toCIR(),
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
            targetDomain instanceof RCTypeSet &&
            retainedValueCIR?.kind === 'CALL' &&
            valueIsolationLevel === UNIQUE
        ) {
            context.scope.emitted.push({
                kind: 'ASSIGN',
                target,
                value: {
                    kind: 'AS_SHARED',
                    object: retainedValueCIR,
                    value: targetDomain.toCIR(),
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
            this.target.domain(context),
            this.target.isolationLevel(context),
        ])
        if (collected.isError) return collected
        const [targetDomain, targetIsolationLevel] = collected.value

        if (targetIsolationLevel === UNKNOWN)
            return SemanticErrorResult.failure(
                'Cannot assign to UNKNOWN isolation target',
                this.span,
            )

        const explicitDomainContext = {
            ...context,
            isolationLevel: targetIsolationLevel,
            explicitDomain: targetDomain,
        }
        const assignedValueResult = this.value.currentValue(
            explicitDomainContext,
        )
        if (assignedValueResult.isError) return assignedValueResult
        const assignedValue = assignedValueResult.value
        if (!targetDomain.isSupersetTo(assignedValue))
            return SemanticErrorResult.failure(
                `Cannot assign value of type ${assignedValue.toString()} to target of type ${targetDomain.toString()}`,
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
