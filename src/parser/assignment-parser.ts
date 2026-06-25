import { TokenStream } from '../lexer'
import { Assignment } from '../model/assignment'
import { ExpressionParser } from './expression.parser'
import { StatementParser } from './statement-parser'
import { ErrorReporter } from '../diagnostics'
import { FieldLookupExpression } from '../model/field-lookup-expression'
import { VariableReference } from '../model/variable-reference'

export class AssignmentParser implements StatementParser<Assignment> {
    private constructor(private errorReporter: ErrorReporter) {}

    static create({ errorReporter }: { errorReporter: ErrorReporter }) {
        return new AssignmentParser(errorReporter)
    }

    isNext(stream: TokenStream): boolean {
        const clone = stream.clone()
        try {
            ExpressionParser.create({
                errorReporter: this.errorReporter,
            }).parse(clone)
            clone.expect('PUNCTUATION', '=')
            return true
        } catch {
            return false
        }
    }

    parse(stream: TokenStream) {
        const expressionParser = ExpressionParser.create({
            errorReporter: this.errorReporter,
        })
        const target = expressionParser.parse(stream)
        if (
            target instanceof VariableReference ||
            target instanceof FieldLookupExpression
        ) {
            stream.expect('PUNCTUATION', '=')
            const value = expressionParser.parse(stream)
            return Assignment.create({ target, value })
        } else {
            this.errorReporter.reportFatalError(
                'Invalid assignment target. Only variables and fields are allowed.',
                { start: stream.peek()!!.start, end: stream.peek()!!.end },
            )
        }
    }
}
