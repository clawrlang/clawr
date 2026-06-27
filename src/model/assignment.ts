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
        if (this.target.semantics(context) !== this.value.semantics(context))
            context.errorReporter.reportFatalError(
                `Cannot assign ${this.value.semantics(context)} value to ${this.target.semantics(context)} target`,
                { start: this.span.start, end: this.span.end },
            )

        this.target.allowAssignment(context)
        return {
            kind: 'ASSIGN',
            target: this.target.toCIR(context),
            value: this.value.toCIR(context),
        }
    }
}
