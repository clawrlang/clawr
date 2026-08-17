import { Statement, Expression, Context } from '.'
import { IsolationLevel, UNIQUE, UNKNOWN } from './isolation-level'
import { FieldReference } from './field-reference'
import { VariableReference } from './variable-reference'
import { SourceCodeSpan } from '../diagnostics'
import { logSemanticError, SemanticError } from './failable'
import { Lattice, RCTypeLattice } from './lattice'

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
        const targetResult = this.target.declaredValueSet(context)
        if (targetResult.isFailure()) {
            for (const error of targetResult.getError().errors)
                context.errorReporter.reportError(error.message, error.span)
        }
        const targetLattice = targetResult.value()
        const targetIsolationLevel = this.target.isolationLevel(context).value()
        const assignedValue = this.value.currentValue(context).value()

        const valueIsolationLevel = this.value.isolationLevel(context).value()
        if (valueIsolationLevel === UNKNOWN)
            throw SemanticError.create({
                message:
                    'Parameter with unspecified isolation level may not be used in assignment',
                span: this.value.span,
            })
        this.checkValidity(
            targetLattice,
            assignedValue,
            context,
            targetIsolationLevel,
        )

        this.emitCIRStatements(context, targetLattice, targetIsolationLevel)
        this.target.setCurrentValue(context, assignedValue)
    }

    private emitCIRStatements(
        context: Context,
        targetLattice: Lattice,
        targetIsolationLevel: IsolationLevel | UNKNOWN,
    ) {
        const prelude = this.target.assignmentPrelude(context)
        context.scope.emitted.push(...prelude)

        const value = this.value
            .toCIRExpression({
                ...context,
                explicitLattice: targetLattice,
                isolationLevel:
                    targetIsolationLevel !== UNKNOWN
                        ? targetIsolationLevel
                        : undefined,
            })
            .value()
        if (
            (value.kind === 'FIELD_REF' || value.kind === 'VARIABLE_REF') &&
            this.target.declaredValueSet(context).value() instanceof
                RCTypeLattice
        ) {
            const tempVar = context.scope.nextTempVar()

            context.scope.emitted.push({
                kind: 'VARIABLE_DECL' as const,
                name: tempVar,
                valueSet: targetLattice.toCIR(),
                initialValue: this.target.toCIRExpression(context).value(),
            })

            context.scope.emitted.push(
                {
                    kind: 'ASSIGN',
                    target: this.target.toCIRExpression(context).value(),
                    value: {
                        kind: 'RETAIN',
                        object: value,
                    },
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
            this.target.declaredValueSet(context).value() instanceof
                RCTypeLattice &&
            value.kind === 'CALL' &&
            this.value.isolationLevel(context).value() === UNIQUE
        ) {
            context.scope.emitted.push({
                kind: 'ASSIGN',
                target: this.target.toCIRExpression(context).value(),
                value: {
                    kind: 'AS_SHARED',
                    object: value,
                },
            })
        } else {
            context.scope.emitted.push({
                kind: 'ASSIGN',
                target: this.target.toCIRExpression(context).value(),
                value,
            })
        }
    }

    private checkValidity(
        targetLattice: Lattice,
        assignedValue: Lattice,
        context: Context,
        targetIsolationLevel: string,
    ) {
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
