import * as cir from '../cir'
import * as model from '../model'
import { TokenStream } from '../lexer'
import { CallFuncParser } from './call-func-parser'

export class ExpressionParser {
    private constructor(private tokenStream: TokenStream) {}

    static create(tokenStream: TokenStream): ExpressionParser {
        return new ExpressionParser(tokenStream)
    }

    parse(): model.Expression {
        const nextToken = this.tokenStream.peek()
        if (!nextToken) {
            throw new Error('Unexpected end of input while parsing expression')
        }
        switch (nextToken.kind) {
            case 'TRUTHVALUE_LITERAL':
                this.tokenStream.next() // Consume the token
                return model.TruthValueLiteral.create(nextToken.value)
            case 'INTEGER_LITERAL':
                this.tokenStream.next() // Consume the token
                return model.IntegerLiteral.create(nextToken.value)
            case 'OPERATOR':
                if (nextToken.operator === '-') {
                    this.tokenStream.next() // Consume the token
                    const nextToken = this.tokenStream.next()
                    if (nextToken?.kind !== 'INTEGER_LITERAL') {
                        throw new Error(
                            'Expected integer literal after "-" operator',
                        )
                    }
                    return model.IntegerLiteral.create(-nextToken.value)
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
            statements.push(
                CallFuncParser.create(this.tokenStream).parse().toCir(),
            )
        }
        return statements
    }
}
