import { Statement, Expression, Context } from '.'
import { UNIQUE, UNKNOWN } from './isolation-level'
import { FieldReference } from './field-reference'
import { VariableReference } from './variable-reference'
import { SourceCodeSpan } from '../diagnostics'
import { Failable, logSemanticError, SemanticError } from './failable'
import { RCTypeLattice } from './lattice'

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
        return Failable.collect([
            this.target.declaredLattice(context),
            this.target.isolationLevel(context),
        ]).chaining(([targetLattice, targetIsolationLevel]) => {
            const prelude = this.target.assignmentPrelude(context)
            context.scope.emitted.push(...prelude)

            return Failable.collect([
                this.value.toCIRExpression({
                    ...context,
                    explicitLattice: targetLattice,
                    isolationLevel:
                        targetIsolationLevel !== UNKNOWN
                            ? targetIsolationLevel
                            : undefined,
                }),
                this.target.toCIRExpression(context),
                this.value.isolationLevel(context),
            ]).chaining(([value, target, valueIsolationLevel]) => {
                if (
                    (value.kind === 'FIELD_REF' ||
                        value.kind === 'VARIABLE_REF') &&
                    targetLattice instanceof RCTypeLattice
                ) {
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
                            value: {
                                kind: 'RETAIN',
                                object: value,
                                value: targetLattice.toCIR(),
                            },
                        },
                        {
                            kind: 'RELEASE',
                            object: {
                                kind: 'VARIABLE_REF',
                                name: tempVar,
                                value: value.value,
                            },
                        },
                    )
                } else if (
                    targetLattice instanceof RCTypeLattice &&
                    value.kind === 'CALL' &&
                    valueIsolationLevel === UNIQUE
                ) {
                    context.scope.emitted.push({
                        kind: 'ASSIGN',
                        target,
                        value: {
                            kind: 'AS_SHARED',
                            object: value,
                            value: targetLattice.toCIR(),
                        },
                    })
                } else {
                    context.scope.emitted.push({
                        kind: 'ASSIGN',
                        target,
                        value,
                    })
                }
                return Failable.success(undefined)
            })
        })
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
