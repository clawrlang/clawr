import { TokenStream } from '@/lexer'
import { Assignment } from '@/model/assignment'
import { FieldReference } from '@/model/field-reference'
import { SelfAssignment } from '@/model/self-assignment'
import { VariableReference } from '@/model/variable-reference'
import { Context } from '@/parser'
import { ExpressionParser } from '@/parser/expression-parser'
import { DataLiteralParser } from '@/parser/literals'
import { StatementParser } from '@/parser/statement-parser'
import { SourceError } from '@/tools'

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
            throw SourceError.create({
                message:
                    'Invalid assignment target. Only variables and fields are allowed.',
                span: {
                    start: stream.peek()!!.start,
                    end: stream.peek()!!.end,
                },
            })
        }
    }
}
