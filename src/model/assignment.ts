import * as cir from '@/cir'
import { Statement, Expression, Context } from '.'
import { AnyIsolationLevel, ISOLATED, UNIQUE, UNKNOWN } from './isolation-level'
import { FieldReference } from './field-reference'
import { VariableReference } from './variable-reference'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { Lattice, RCTypeLattice } from './lattice'
import { Retain } from './retain'
import { Failable, isFailure, Result } from '@/tools/failable'

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

    *emitStatement(context: Context): Failable {
        const validity = yield* this.checkValidity(context)
        if (isFailure(validity)) return validity
        const targetLattice: Lattice =
            yield yield* this.target.declaredLattice(context)
        const explicitLatticeContext = {
            ...context,
            isolationLevel: yield yield* this.target.isolationLevel(context),
            explicitLattice: targetLattice,
        }
        yield yield* this.emitCIRStatements(context)
        const value: Lattice = yield yield* this.value.currentValue(
            explicitLatticeContext,
        )
        return yield* this.target.setCurrentValue(context, value)
    }

    private *emitCIRStatements(context: Context): Failable {
        const targetLattice: Lattice =
            yield yield* this.target.declaredLattice(context)
        const target: cir.Expression & {
            kind: 'VARIABLE_REF' | 'FIELD_REF'
        } = yield yield* this.target.toCIRExpression(context)
        const explicitLatticeContext = {
            ...context,
            isolationLevel: yield yield* this.target.isolationLevel(context),
            explicitLattice: targetLattice,
        }

        const valueIsolationLevel: AnyIsolationLevel =
            yield yield* this.value.isolationLevel(explicitLatticeContext)
        const retainedValue: Expression = yield yield* Retain.ifStorage(
            this.value,
            context,
        )
        const retainedValueCIRResult = yield* retainedValue.toCIRExpression(
            explicitLatticeContext,
        )
        if (isFailure(retainedValueCIRResult)) return retainedValueCIRResult
        const retainedValueCIR: cir.Expression = yield retainedValueCIRResult
        const prelude = yield yield* this.target.assignmentPrelude(context)
        context.scope.emitted.push(...prelude)

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

    private *checkValidity(context: Context): Failable {
        const targetLatticeResult = yield* this.target.declaredLattice(context)
        if (isFailure(targetLatticeResult)) return targetLatticeResult
        const targetLattice: Lattice = yield targetLatticeResult
        const explicitLatticeContext = {
            ...context,
            isolationLevel: yield yield* this.target.isolationLevel(context),
            explicitLattice: targetLattice,
        }
        const assignedValue: Lattice = yield yield* this.value.currentValue(
            explicitLatticeContext,
        )
        if (!targetLattice.isSupersetTo(assignedValue))
            yield Result.failure(
                `Cannot assign value of type ${assignedValue?.toString() ?? this.value.constructor.name} to target of type ${targetLattice.toString()}`,
                this.span,
            )
        const valueIsolationLevel: AnyIsolationLevel =
            yield yield* this.value.isolationLevel(context)
        if (valueIsolationLevel === UNIQUE) return Result.success
        if (valueIsolationLevel === UNKNOWN)
            yield Result.failure(
                'Parameter with unspecified isolation level may not be used in assignment',
                this.value.span,
            )
        const targetIsolationLevel: AnyIsolationLevel =
            yield yield* this.target.isolationLevel(context)
        if (targetIsolationLevel !== valueIsolationLevel)
            yield Result.failure(
                `Cannot assign ${valueIsolationLevel} value to ${targetIsolationLevel} target`,
                this.span,
            )
        return Result.success
    }
}
