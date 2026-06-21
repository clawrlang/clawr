import * as cir from '../cir'
import { Expression } from '../cir'
import { TokenStream } from '../lexer'
import { CallParser } from './call-func-parser'

export class ExpressionParser {
    private constructor(private tokenStream: TokenStream) {}

    static create(tokenStream: TokenStream): ExpressionParser {
        return new ExpressionParser(tokenStream)
    }

    parse(): Expression {
        const nextToken = this.tokenStream.peek()
        if (!nextToken) {
            throw new Error('Unexpected end of input while parsing expression')
        }
        switch (nextToken.kind) {
            case 'TRUTHVALUE_LITERAL':
                this.tokenStream.next() // Consume the token
                return { type: 'TRUTHVALUE_LITERAL', value: nextToken.value }
            case 'INTEGER_LITERAL':
                this.tokenStream.next() // Consume the token
                return {
                    type: 'INTEGER_LITERAL',
                    value: nextToken.value.toString(),
                }
            case 'OPERATOR':
                if (nextToken.operator === '-') {
                    this.tokenStream.next() // Consume the token
                    const nextToken = this.tokenStream.next()
                    if (nextToken?.kind !== 'INTEGER_LITERAL') {
                        throw new Error(
                            'Expected integer literal after "-" operator',
                        )
                    }
                    return {
                        type: 'INTEGER_LITERAL',
                        value: `-${nextToken.value.toString()}`,
                    }
                }
            default:
                throw new Error(
                    `Unexpected token kind: ${nextToken.kind} while parsing expression`,
                )
        }
    }
}
export class ModuleParser {
    private constructor(private tokenStream: TokenStream) {}

    static create(tokenStream: TokenStream): ModuleParser {
        return new ModuleParser(tokenStream)
    }

    parse(): cir.Cir {
        this.tokenStream.expect('ANNOTATION', '@main')
        this.tokenStream.expect('PUNCTUATION', '{')
        const body = this.parseStatements()
        this.tokenStream.expect('PUNCTUATION', '}')
        return { $main: body }
    }

    private parseStatements(): cir.Statement[] {
        const statements: cir.Statement[] = []
        while (!this.tokenStream.isNext('PUNCTUATION', '}')) {
            statements.push(CallParser.create(this.tokenStream).parse())
        }
        return statements
    }
}
