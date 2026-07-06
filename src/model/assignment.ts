import { Statement, Expression, Context, isReferenceCounted } from '.'
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
        const valueSemantics = this.value.semantics(context)
        const targetSemantics = this.target.semantics(context)
        const isValueSemanticsMismatch =
            valueSemantics !== 'UNIQUE' && targetSemantics !== valueSemantics
        if (isValueSemanticsMismatch)
            context.errorReporter.reportFatalError(
                `Cannot assign ${valueSemantics} value to ${targetSemantics} target`,
                { start: this.span.start, end: this.span.end },
            )

        const prelude = this.target.assignmentPrelude(context)
        context.scope.emitted.statements.push(...prelude)

        const targetValueSet = this.target.valueSet(context)
        const valueCIR = this.value.toCIRExpression({
            ...context,
            ...targetValueSet,
            ...{ semantics: targetSemantics },
        })

        if (
            (valueCIR.kind === 'FIELD_REF' ||
                valueCIR.kind === 'VARIABLE_REF') &&
            isReferenceCounted(targetValueSet.type)
        ) {
            const tempVar = context.scope.nextTempVar()

            context.scope.emitted.statements.push({
                kind: 'VARIABLE_DECL' as const,
                name: tempVar,
                valueSet: targetValueSet,
                initialValue: this.target.toCIRExpression(context),
            })

            context.scope.emitted.statements.push(
                {
                    kind: 'ASSIGN',
                    target: this.target.toCIRExpression(context),
                    value: { kind: 'RETAIN', object: valueCIR },
                },
                {
                    kind: 'RELEASE',
                    object: { kind: 'VARIABLE_REF', name: tempVar },
                },
            )
        } else
            context.scope.emitted.statements.push({
                kind: 'ASSIGN',
                target: this.target.toCIRExpression(context),
                value: valueCIR,
            })
    }
}
