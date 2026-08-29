import { describe, expect, it } from 'bun:test'
import { TokenStream } from '@/lexer'
import { ExpressionParser } from '@/parser/expression-parser'
import { TestErrorReporter } from '@@/util'
import { TruthValueLiteral } from '@/model/truthvalue-literal'
import { IntegerLiteral } from '@/model/integer-literal'
import { VariableReference } from '@/model/variable-reference'
import { FieldReference } from '@/model/field-reference'
import { Expression } from '@/model'
import { Query } from '@/model/query'

describe('Expression Parser', () => {
    describe('truthvalue literals', () => {
        const cases = ['true', 'false', 'ambiguous'] as const
        for (const input of cases) {
            it(`parses ${input} as Truthvalue`, () => {
                const literal = parseExpression(input)
                expect(literal).toMatchObject({ value: { values: [input] } })
                expect(literal).toBeInstanceOf(TruthValueLiteral)
            })
        }
    })

    describe('integer literals', () => {
        const cases = ['0', '1', '2', '-1', '123456789'] as const
        for (const input of cases) {
            it(`parses ${input} as Integer`, () => {
                const literal = parseExpression(input)
                expect(literal).toMatchObject({
                    value: { max: BigInt(input), min: BigInt(input) },
                })
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
                { name: 'x', value: { value: { max: 42n, min: 42n } } },
                { name: 'y', value: { value: { max: 17n, min: 17n } } },
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
        const input = 'myVar->field1->field2'
        const fieldAccess = parseExpression(input)
        expect(fieldAccess).toMatchObject({
            object: { object: { name: 'myVar' }, field: 'field1' },
            field: 'field2',
        })
        expect(fieldAccess).toBeInstanceOf(FieldReference)
    })

    it('parses a function call', () => {
        const code = 'add(1, 2)'
        const result = parseExpression(code)
        expect(result).toBeInstanceOf(Query)
        expect(result).toMatchObject({
            name: { baseName: 'add', labels: [] },
            arguments: [
                { value: { min: 1n, max: 1n } },
                { value: { min: 2n, max: 2n } },
            ],
        })
    })
})

function parseExpression(input: string): Expression {
    const errorReporter = new TestErrorReporter()
    const tokenStream = TokenStream.read(input, errorReporter)
    return ExpressionParser.create({
        errorReporter,
    }).parse(tokenStream)
}
