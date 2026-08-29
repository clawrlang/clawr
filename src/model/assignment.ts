import * as cir from '@/cir'
import { Statement, Expression, Context } from '.'
import { AnyIsolationLevel, UNIQUE, UNKNOWN } from './isolation-level'
import { FieldReference } from './field-reference'
import { VariableReference } from './variable-reference'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { Lattice, RCTypeLattice } from './lattice'
import { Retain } from './retain'
import { Failable, isFailure } from '@/tools/failable'

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
        yield yield* this.emitCIRStatements(context)
        const value: Lattice = yield yield* this.value.currentValue(context)
        return yield* this.target.setCurrentValue(context, value)
    }

    private *emitCIRStatements(context: Context): Failable {
        const targetLattice: Lattice =
            yield yield* this.target.declaredLattice(context)
        const target: cir.Expression & {
            kind: 'VARIABLE_REF' | 'FIELD_REF'
        } = yield yield* this.target.toCIRExpression(context)
        const valueIsolationLevel: AnyIsolationLevel =
            yield yield* this.value.isolationLevel(context)
        const retainedValue: Expression = yield yield* Retain.ifStorage(
            this.value,
            context,
        )
        const retainedValueCIR: cir.Expression =
            yield yield* retainedValue.toCIRExpression(context)
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
            retainedValueCIR.kind === 'CALL' &&
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
        return Failable.success()
    }

    private *checkValidity(context: Context): Failable {
        const targetLatticeResult = yield* this.target.declaredLattice(context)
        if (isFailure(targetLatticeResult)) return targetLatticeResult
        const targetLattice: Lattice = yield targetLatticeResult
        const assignedValue: Lattice =
            yield yield* this.value.currentValue(context)
        if (!targetLattice.isSupersetTo(assignedValue))
            yield Failable.failure(
                `Cannot assign value of type ${assignedValue.toString()} to target of type ${targetLattice.toString()}`,
                this.span,
            )
        const valueIsolationLevel: AnyIsolationLevel =
            yield yield* this.value.isolationLevel(context)
        if (valueIsolationLevel === UNIQUE) return Failable.success()
        if (valueIsolationLevel === UNKNOWN)
            yield Failable.failure(
                'Parameter with unspecified isolation level may not be used in assignment',
                this.value.span,
            )
        const targetIsolationLevel: AnyIsolationLevel =
            yield yield* this.target.isolationLevel(context)
        if (targetIsolationLevel !== valueIsolationLevel)
            yield Failable.failure(
                `Cannot assign ${valueIsolationLevel} value to ${targetIsolationLevel} target`,
                this.span,
            )
        return Failable.success()
    }
}
