import { TokenStream } from '@/lexer'
import { Assignment } from '@/model/assignment'
import { FieldReference } from '@/model/field-reference'
import { SelfAssignment } from '@/model/self-assignment'
import { VariableReference } from '@/model/variable-reference'
import { Context } from '.'
import { DataLiteralParser } from './data-literal-parser'
import { ExpressionParser } from './expression-parser'
import { StatementParser } from './statement-parser'

export class AssignmentParser implements StatementParser<
    Assignment | SelfAssignment
> {
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

    parse(stream: TokenStream): Assignment | SelfAssignment {
        const expressionParser = ExpressionParser.create(this.context)
        const target = expressionParser.parse(stream)
        if (target instanceof VariableReference && target.name === 'self') {
            const equalsToken = stream.expect('PUNCTUATION', '=')
            const value = DataLiteralParser.create(this.context).parse(stream)
            return SelfAssignment.create({
                value: value,
                span: { start: equalsToken.start, end: equalsToken.end },
            })
        } else if (
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
