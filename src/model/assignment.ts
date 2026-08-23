import * as cir from '../cir'
import { Statement, Expression, Context } from '.'
import { UNIQUE, UNKNOWN } from './isolation-level'
import { FieldReference } from './field-reference'
import { VariableReference } from './variable-reference'
import { SourceCodeSpan } from '../diagnostics'
import { Failable, logSemanticError, SemanticError } from './failable'
import { RCTypeLattice } from './lattice'
import { Retain } from './retain'

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

    emitStatement(context: Context) {
        this.checkValidity(context)
        this.emitCIRStatements(context).throwIfFailure()
        this.target.setCurrentValue(
            context,
            this.value.currentValue(context).value(),
        )
    }

    private emitCIRStatements(context: Context): Failable {
        return Failable.pipe(
            Failable.collect([
                this.target.declaredLattice(context),
                this.target.toCIRExpression(context),
                this.value.isolationLevel(context),
                Retain.ifStorage(this.value, context),
            ]),
            ([targetLattice, target, valueIsolationLevel, retainedValue]) => {
                return retainedValue
                    .toCIRExpression(context)
                    .chaining(
                        (retainedValueCIR) =>
                            [
                                targetLattice,
                                target,
                                valueIsolationLevel,
                                retainedValue,
                                retainedValueCIR,
                            ] as const,
                    )
            },
            ([
                targetLattice,
                target,
                valueIsolationLevel,
                retainedValue,
                retainedValueCIR,
            ]) => {
                const prelude = this.target.assignmentPrelude(context)
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
            },
        )
    }

    private checkValidity(context: Context) {
        const targetResult = this.target.declaredLattice(context)
        if (targetResult.isFailure()) {
            for (const error of targetResult.getError().errors)
                context.errorReporter.reportError(error.message, error.span)
        }

        const targetLattice = this.target.declaredLattice(context).value()
        const assignedValue = this.value.currentValue(context).value()
        if (!targetLattice.isSupersetTo(assignedValue))
            logSemanticError(
                `Cannot assign value of type ${assignedValue.toString()} to target of type ${targetLattice.toString()}`,
                {
                    ...context,
                    span: { start: this.span.start, end: this.span.end },
                },
            )
        const valueIsolationLevel = this.value.isolationLevel(context).value()
        if (valueIsolationLevel === UNIQUE) return
        if (valueIsolationLevel === UNKNOWN)
            throw SemanticError.create({
                message:
                    'Parameter with unspecified isolation level may not be used in assignment',
                span: this.value.span,
            })
        const targetIsolationLevel = this.target.isolationLevel(context).value()
        if (targetIsolationLevel !== valueIsolationLevel)
            logSemanticError(
                `Cannot assign ${valueIsolationLevel} value to ${targetIsolationLevel} target`,
                {
                    ...context,
                    span: { start: this.span.start, end: this.span.end },
                },
            )
    }
}
