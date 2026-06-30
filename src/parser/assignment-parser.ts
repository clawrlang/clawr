import { TokenStream } from '../lexer'
import { Assignment } from '../model/assignment'
import { ExpressionParser } from './expression.parser'
import { StatementParser } from './statement-parser'
import { FieldReference } from '../model/field-reference'
import { VariableReference } from '../model/variable-reference'
import { Context } from '.'

export class AssignmentParser implements StatementParser<Assignment> {
    private constructor(private context: Context) {}

    static create(context: Context) {
        return new AssignmentParser(context)
    }

    isNext(stream: TokenStream): boolean {
        const clone = stream.clone()
        try {
            ExpressionParser.create(this.context).parse(clone)
            clone.expect('PUNCTUATION', '=')
            return true
        } catch {
            return false
        }
    }

    parse(stream: TokenStream) {
        const expressionParser = ExpressionParser.create(this.context)
        const target = expressionParser.parse(stream)
        if (
            target instanceof VariableReference ||
            target instanceof FieldReference
        ) {
            const equalsToken = stream.expect('PUNCTUATION', '=')
            const value = expressionParser.parse(stream)
            return Assignment.create({
                target,
                value,
                span: { start: equalsToken.start, end: equalsToken.end },
            })
        } else {
            this.context.errorReporter.reportFatalError(
                'Invalid assignment target. Only variables and fields are allowed.',
                { start: stream.peek()!!.start, end: stream.peek()!!.end },
            )
        }
    }
}
