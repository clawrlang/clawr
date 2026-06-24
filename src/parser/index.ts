import * as model from '../model'
import { TokenStream } from '../lexer'
import { CallFuncParser } from './call-func-parser'
import { VariableDeclarationParser } from './variable-declaration-parser'
import { DataDeclarationParser } from './data-declaration-parser'
import { DataLiteralParser } from './data-literal-parser'

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
            case 'IDENTIFIER':
                this.tokenStream.next() // Consume the token
                if (this.tokenStream.isNext('OPERATOR', '.')) {
                    this.tokenStream.next() // Consume the '.'
                    const fieldToken = this.tokenStream.next()
                    if (fieldToken?.kind !== 'IDENTIFIER') {
                        throw new Error('Expected field name after "."')
                    }
                    return model.FieldLookupExpression.create({
                        object: model.VariableReference.create(
                            nextToken.identifier,
                        ),
                        field: fieldToken.identifier,
                    })
                }
                return model.VariableReference.create(nextToken.identifier)
            case 'PUNCTUATION':
                if (nextToken.symbol === '{') {
                    return DataLiteralParser.create({
                        tokenStream: this.tokenStream,
                    }).parse()
                } else {
                    throw new Error(
                        `Unexpected punctuation symbol: ${nextToken.symbol} while parsing expression`,
                    )
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
                    return model.IntegerLiteral.create(-nextToken.value)
                } else {
                    throw new Error(
                        `Unexpected operator "${nextToken.operator}" while parsing expression`,
                    )
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

    parse(): model.Module {
        let main: model.Statement[] = []
        const declarations: model.Declaration[] = []

        if (this.tokenStream.isNext('ANNOTATION', '@main')) {
            this.tokenStream.expect('ANNOTATION', '@main')
            this.tokenStream.expect('PUNCTUATION', '{')
            main = this.parseStatements()
            this.tokenStream.expect('PUNCTUATION', '}')
        } else if (this.tokenStream.isNext('KEYWORD', 'data')) {
            declarations.push(
                DataDeclarationParser.create({
                    tokenStream: this.tokenStream,
                }).parse(),
            )
        } else {
            throw new Error(
                `Unexpected token kind: ${this.tokenStream.peek()?.kind} while parsing module`,
            )
        }
        return model.Module.create({ main, declarations })
    }
    private parseStatements() {
        const callFuncParser = CallFuncParser.create(this.tokenStream)
        const variableDeclarationParser = VariableDeclarationParser.create({
            tokenStream: this.tokenStream,
        })
        const statements: model.Statement[] = []
        while (!this.tokenStream.isNext('PUNCTUATION', '}')) {
            if (this.tokenStream.isNext('KEYWORD', 'const', 'mut')) {
                statements.push(variableDeclarationParser.parse())
            } else {
                statements.push(callFuncParser.parse())
            }
        }
        return statements
    }
}
