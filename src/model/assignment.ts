import { SourceCodeSpan } from '@/tools/diagnostics'
import { Failable, isFailure, Result } from '@/tools/failable'
import { Context, Expression, Statement } from '.'
import { FieldReference } from './field-reference'
import { UNIQUE, UNKNOWN } from './isolation-level'
import { Lattice, RCTypeLattice } from './lattice'
import { Retain } from './retain'
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

    emitStatement(context: Context): Result {
        const self = this
        return Failable.do(function* () {
            const validity = self.checkValidity(context)
            if (isFailure(validity)) return validity
            const targetLattice: Lattice =
                yield self.target.declaredLattice(context)
            const explicitLatticeContext = {
                ...context,
                isolationLevel: yield self.target.isolationLevel(context),
                explicitLattice: targetLattice,
            }
            yield self.emitCIRStatements(context)
            const value: Lattice = yield self.value.currentValue(
                explicitLatticeContext,
            )
            return self.target.setCurrentValue(context, value)
        })
    }

    private emitCIRStatements(context: Context): Result {
        const collectedTargetResults = Failable.collect([
            this.target.isolationLevel(context),
            this.target.declaredLattice(context),
            this.target.toCIRExpression(context),
        ])
        if (isFailure(collectedTargetResults)) return collectedTargetResults
        const [targetIsolationLevel, targetLattice, target] =
            collectedTargetResults.value

        const explicitLatticeContext = {
            ...context,
            isolationLevel: targetIsolationLevel,
            explicitLattice: targetLattice,
        }
        const collectedValueResults = Failable.collect([
            this.value.isolationLevel(explicitLatticeContext),
            Retain.ifStorage(this.value, context),
        ])
        if (isFailure(collectedValueResults)) return collectedValueResults

        const [valueIsolationLevel, retainedValue] = collectedValueResults.value
        if (explicitLatticeContext.isolationLevel === UNKNOWN)
            return Result.failure(
                'Cannot assign to parameter with UNKNOWN isolationLevel',
                this.span,
            )
        const retainedValueCIRResult = retainedValue.toCIRExpression({
            ...explicitLatticeContext,
            isolationLevel: explicitLatticeContext.isolationLevel,
        })
        if (isFailure(retainedValueCIRResult)) return retainedValueCIRResult

        const retainedValueCIR = retainedValueCIRResult.value

        const preludeResult = this.target.assignmentPrelude(context)
        if (isFailure(preludeResult)) return preludeResult

        context.scope.emitted.push(...preludeResult.value)

        if (retainedValue instanceof Retain) {
            const tempVar = context.scope.nextTempVar()

            context.scope.emitted.push({
                kind: 'VARIABLE_DECL' as const,
                name: tempVar,
                lattice: targetLattice.toCIR(),
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
            targetLattice instanceof RCTypeLattice &&
            retainedValueCIR?.kind === 'CALL' &&
            valueIsolationLevel === UNIQUE
        ) {
            context.scope.emitted.push({
                kind: 'ASSIGN',
                target,
                value: {
                    kind: 'AS_SHARED',
                    object: retainedValueCIR,
                    value: targetLattice.toCIR(),
                },
            })
        } else {
            context.scope.emitted.push({
                kind: 'ASSIGN',
                target,
                value: retainedValueCIR,
            })
        }
        return Result.success
    }

    private checkValidity(context: Context): Result {
        const collected = Failable.collect([
            this.target.declaredLattice(context),
            this.target.isolationLevel(context),
        ])
        if (isFailure(collected)) return collected
        const [targetLattice, targetIsolationLevel] = collected.value

        if (targetIsolationLevel === UNKNOWN)
            return Result.failure(
                'Cannot assign to UNKNOWN isolation target',
                this.span,
            )

        const explicitLatticeContext = {
            ...context,
            isolationLevel: targetIsolationLevel,
            explicitLattice: targetLattice,
        }
        const assignedValueResult = this.value.currentValue(
            explicitLatticeContext,
        )
        if (isFailure(assignedValueResult)) return assignedValueResult
        const assignedValue = assignedValueResult.value
        if (!targetLattice.isSupersetTo(assignedValue))
            return Result.failure(
                `Cannot assign value of type ${assignedValue?.toString() ?? this.value.constructor.name} to target of type ${targetLattice.toString()}`,
                this.span,
            )
        const valueIsolationLevelResult = this.value.isolationLevel(context)
        if (isFailure(valueIsolationLevelResult))
            return valueIsolationLevelResult
        const valueIsolationLevel = valueIsolationLevelResult.value
        if (valueIsolationLevel === UNIQUE) return Result.success
        if (valueIsolationLevel === UNKNOWN)
            return Result.failure(
                'Parameter with unspecified isolation level may not be used in assignment',
                this.value.span,
            )
        if (targetIsolationLevel !== valueIsolationLevel)
            return Result.failure(
                `Cannot assign ${valueIsolationLevel} value to ${targetIsolationLevel} target`,
                this.span,
            )
        return Result.success
    }
}
