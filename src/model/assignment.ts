import * as cir from '../cir'
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

    toCIR(context: Context): cir.Statement {
        const valueSemantics = this.value.semantics(context)
        const targetSemantics = this.target.semantics(context)
        const isValueSemanticsMismatch =
            valueSemantics !== 'UNIQUE' && targetSemantics !== valueSemantics
        if (isValueSemanticsMismatch)
            context.errorReporter.reportFatalError(
                `Cannot assign ${valueSemantics} value to ${targetSemantics} target`,
                { start: this.span.start, end: this.span.end },
            )

        this.target.allowAssignment(context)
        return {
            kind: 'ASSIGN',
            target: this.target.toCIR(context),
            value: this.value.toCIR({
                ...context,
                ...this.target.valueSet(context),
                ...{ semantics: this.target.semantics(context) },
            }),
        }
    }
}
