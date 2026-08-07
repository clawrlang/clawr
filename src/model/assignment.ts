import { Statement, Expression, Context } from '.'
import { FieldReference } from './field-reference'
import { VariableReference } from './variable-reference'
import { SourceCodeSpan } from '../diagnostics'
import { UniqueTypeLattice } from './lattice'
import { logSemanticError } from './failable'

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
        const value = this.value
            .toCIRExpression({
                ...context,
                ...{ targetValueSet: target.valueSet },
            })
            .value()

        if (target.valueSet.type !== value.valueSet.type)
            logSemanticError(
                `Cannot assign value of type ${value.valueSet.type} to target of type ${target.valueSet.type}`,
                {
                    ...context,
                    span: { start: this.span.start, end: this.span.end },
                },
            )
        const currentValue = this.value.currentValue(context).value()
        if (
            target.valueSet.type === 'rc-type' &&
            value.valueSet.type === 'rc-type' &&
            target.valueSet.semantics !== value.valueSet.semantics &&
            !(currentValue instanceof UniqueTypeLattice)
        )
            logSemanticError(
                `Cannot assign ${value.valueSet.semantics} value to ${target.valueSet.semantics} target`,
                {
                    ...context,
                    span: { start: this.span.start, end: this.span.end },
                },
            )

        const prelude = this.target.assignmentPrelude(context)
        context.scope.emitted.push(...prelude)

        const targetValueSet = this.target
            .toCIRExpression(context)
            .value().valueSet

        if (
            (value.kind === 'FIELD_REF' || value.kind === 'VARIABLE_REF') &&
            target.valueSet.type === 'rc-type'
        ) {
            const tempVar = context.scope.nextTempVar()

            context.scope.emitted.push({
                kind: 'VARIABLE_DECL' as const,
                name: tempVar,
                valueSet: targetValueSet,
                initialValue: target,
            })

            context.scope.emitted.push(
                {
                    kind: 'ASSIGN',
                    target,
                    value: {
                        kind: 'RETAIN',
                        object: value,
                        valueSet: targetValueSet as any,
                    },
                },
                {
                    kind: 'RELEASE',
                    object: {
                        kind: 'VARIABLE_REF',
                        name: tempVar,
                        valueSet: targetValueSet,
                    },
                },
            )
        } else if (
            target.valueSet.type === 'rc-type' &&
            value.valueSet.type === 'rc-type' &&
            value.kind === 'CALL' &&
            currentValue instanceof UniqueTypeLattice
        ) {
            context.scope.emitted.push({
                kind: 'ASSIGN',
                target,
                value: {
                    kind: 'AS_SHARED',
                    object: value,
                    valueSet: targetValueSet as any,
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
