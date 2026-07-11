import { Statement, Expression, Context } from '.'
import { FieldReference } from './field-reference'
import { VariableReference } from './variable-reference'
import { SourceCodeSpan } from '../diagnostics'

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
        const target = this.target.toCIRExpression(context)
        const value = this.value.toCIRExpression({
            ...context,
            ...{ targetValueSet: target.valueSet },
        })

        if (target.valueSet.type !== value.valueSet.type)
            context.errorReporter.reportFatalError(
                `Cannot assign value of type ${value.valueSet.type} to target of type ${target.valueSet.type}`,
                { start: this.span.start, end: this.span.end },
            )
        if (
            target.valueSet.type === 'rc-type' &&
            value.valueSet.type === 'rc-type' &&
            target.valueSet.semantics !== value.valueSet.semantics
        )
            context.errorReporter.reportFatalError(
                `Cannot assign ${value.valueSet.semantics} value to ${target.valueSet.semantics} target`,
                { start: this.span.start, end: this.span.end },
            )


        const prelude = this.target.assignmentPrelude(context)
        context.scope.emitted.push(...prelude)

        const targetValueSet = this.target.valueSet(context)

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
        } else {
            context.scope.emitted.push({
                kind: 'ASSIGN',
                target,
                value,
            })
        }
    }
}
