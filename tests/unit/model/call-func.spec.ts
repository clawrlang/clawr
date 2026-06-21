import { describe, it, expect } from 'bun:test'
import { TokenStream } from '../../../src/lexer'
import { TestErrorReporter } from '../../util'
import { CallFuncParser } from '../../../src/parser/call-func-parser'

describe('CallFunc', () => {
    it('parses a simple function call', () => {
        const input = 'foo(42, ambiguous)'
        const tokenStream = TokenStream.read(
            input,
            new TestErrorReporter('test.clawr'),
        )
        const parser = CallFuncParser.create(tokenStream)
        const result = parser.parse().toCir()
        expect(result).toMatchObject({
            type: 'CALL_FUNC',
            signature: {
                baseName: 'foo',
                parameters: [{ type: 'integer' }, { type: 'truthvalue' }],
            },
            arguments: [
                { type: 'INTEGER_LITERAL', value: '42' },
                { type: 'TRUTHVALUE_LITERAL', value: 'ambiguous' },
            ],
        })
    })

    it('converts print(integer) to printInteger()', () => {
        const input = 'print(1)'
        const tokenStream = TokenStream.read(
            input,
            new TestErrorReporter('test.clawr'),
        )
        const parser = CallFuncParser.create(tokenStream)
        const result = parser.parse().toCir()
        expect(result).toMatchObject({
            type: 'CALL_FUNC',
            signature: {
                baseName: 'printInteger',
                parameters: [{ type: 'integer' }],
            },
            arguments: [{ type: 'INTEGER_LITERAL', value: '1' }],
        })
    })

    it('converts print(truthvalue) to printTruthvalue()', () => {
        const input = 'print(true)'
        const tokenStream = TokenStream.read(
            input,
            new TestErrorReporter('test.clawr'),
        )
        const parser = CallFuncParser.create(tokenStream)
        const result = parser.parse().toCir()
        expect(result).toMatchObject({
            type: 'CALL_FUNC',
            signature: {
                baseName: 'printTruthvalue',
                parameters: [{ type: 'truthvalue' }],
            },
            arguments: [{ type: 'TRUTHVALUE_LITERAL', value: 'true' }],
        })
    })
})
