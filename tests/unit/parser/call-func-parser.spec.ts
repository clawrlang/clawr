import { describe, it, expect } from 'bun:test'
import { TokenStream } from '../../../src/lexer'
import { TestErrorReporter } from '../../util'
import { CallParser } from '../../../src/parser/call-func-parser'

describe('Function Call Parsing', () => {
    it('parses a simple function call', () => {
        const input = 'foo(42, ambiguous)'
        const tokenStream = TokenStream.read(
            input,
            new TestErrorReporter('test.clawr'),
        )
        const parser = CallParser.create(tokenStream)
        const result = parser.parse()
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
})
