import { describe, expect, it } from 'bun:test'
import { TokenStream } from '../../../src/lexer'
import { ExpressionParser } from '../../../src/parser/expression-parser'
import { TestErrorReporter } from '../../util'
import { TruthValueLiteral } from '../../../src/model/truthvalue-literal'
import { IntegerLiteral } from '../../../src/model/integer-literal'
import { VariableReference } from '../../../src/model/variable-reference'
import { FieldReference } from '../../../src/model/field-reference'
import { Expression } from '../../../src/model'

describe('Expression Parser', () => {
    describe('truthvalue literals', () => {
        const cases = ['true', 'false', 'ambiguous'] as const
        for (const input of cases) {
            it(`parses ${input} as Truthvalue`, () => {
                const literal = parseExpression(input)
                expect(literal).toMatchObject({ value: input })
                expect(literal).toBeInstanceOf(TruthValueLiteral)
            })
        }
    })

    describe('integer literals', () => {
        const cases = ['0', '1', '2', '-1', '123456789'] as const
        for (const input of cases) {
            it(`parses ${input} as Integer`, () => {
                const literal = parseExpression(input)
                expect(literal).toMatchObject({ value: BigInt(input) })
                expect(literal).toBeInstanceOf(IntegerLiteral)
            })
        }
    })

    it('parses a data literal', () => {
        const code = `
            {
                x: 42
                y: 17
            }`
        const result = parseExpression(code)
        expect(result).toMatchObject({
            fields: [
                { name: 'x', value: { value: 42n } },
                { name: 'y', value: { value: 17n } },
            ],
        })
    })

    it('parses variable references', () => {
        const input = 'myVar'
        const variableRef = parseExpression(input)
        expect(variableRef).toMatchObject({ name: input })
        expect(variableRef).toBeInstanceOf(VariableReference)
    })

    it('parses field lookup expressions', () => {
        const input = 'myVar.field'
        const fieldAccess = parseExpression(input)
        expect(fieldAccess).toMatchObject({
            object: { name: 'myVar' },
            field: 'field',
        })
        expect(fieldAccess).toBeInstanceOf(FieldReference)
    })

    it('parses field lookup expressions', () => {
        const input = 'myVar->field'
        const fieldAccess = parseExpression(input)
        expect(fieldAccess).toMatchObject({
            object: { name: 'myVar' },
            field: 'field',
        })
        expect(fieldAccess).toBeInstanceOf(FieldReference)
    })
})

function parseExpression(input: string): Expression {
    const errorReporter = new TestErrorReporter()
    const tokenStream = TokenStream.read(input, errorReporter)
    return ExpressionParser.create({
        errorReporter,
    }).parse(tokenStream)
}
