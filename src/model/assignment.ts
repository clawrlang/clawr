import { Statement, Expression, Context } from '.'
import { FieldReference } from './field-reference'
import { VariableReference } from './variable-reference'
import { SourceCodeSpan } from '../diagnostics'
import { logSemanticError } from './failable'
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
        const targetResult = this.target.toCIRExpression(context)
        if (targetResult.isFailure()) {
            for (const error of targetResult.getError().errors)
                context.errorReporter.reportError(error.message, error.span)
        }
        const target = targetResult.value()
        const targetValueSet = this.target.declaredValueSet(context).value()
        const targetSemantics = this.target.isolationLevel(context)
        const value = this.value
            .toCIRExpression({
                ...context,
                type:
                    targetValueSet instanceof RCTypeLattice
                        ? targetValueSet.type
                        : undefined,
                semantics:
                    targetSemantics !== 'UNIQUE' ? targetSemantics : undefined,
            })
            .value()

        const valueSet = this.value.currentValue(context).value()
        if (!valueSet.isSameType(targetValueSet))
            logSemanticError(
                `Cannot assign value of type ${valueSet.toString()} to target of type ${targetValueSet.toString()}`,
                {
                    ...context,
                    span: { start: this.span.start, end: this.span.end },
                },
            )
        const valueSemantics = this.value.isolationLevel(context)
        if (targetSemantics !== valueSemantics && valueSemantics !== 'UNIQUE')
            logSemanticError(
                `Cannot assign ${valueSemantics} value to ${targetSemantics} target`,
                {
                    ...context,
                    span: { start: this.span.start, end: this.span.end },
                },
            )

        const prelude = this.target.assignmentPrelude(context)
        context.scope.emitted.push(...prelude)

        if (
            (value.kind === 'FIELD_REF' || value.kind === 'VARIABLE_REF') &&
            this.target.declaredValueSet(context).value() instanceof
                RCTypeLattice
        ) {
            const tempVar = context.scope.nextTempVar()

            context.scope.emitted.push({
                kind: 'VARIABLE_DECL' as const,
                name: tempVar,
                valueSet: targetValueSet.toCIR(),
                initialValue: target,
            })

            context.scope.emitted.push(
                {
                    kind: 'ASSIGN',
                    target,
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
            this.value.isolationLevel(context) === 'UNIQUE'
        ) {
            context.scope.emitted.push({
                kind: 'ASSIGN',
                target,
                value: {
                    kind: 'AS_SHARED',
                    object: value,
                },
            })
        } else {
            context.scope.emitted.push({
                kind: 'ASSIGN',
                target,
                value,
            })
        }
    }
}
