import { describe, it, expect } from 'bun:test'
import { TokenStream } from '../../../src/lexer'
import { TestErrorReporter } from '../../util'
import { CallFuncParser } from '../../../src/parser/call-func-parser'

describe('CallFunc Parser', () => {
    it('parses a simple function call', () => {
        const input = 'foo(42, ambiguous)'
        const errorReporter = new TestErrorReporter()
        const tokenStream = TokenStream.read(input, errorReporter)
        const parser = CallFuncParser.create({ errorReporter })
        const result = parser.parse(tokenStream)
        expect(result).toMatchObject({
            baseName: 'foo',
            arguments: [
                { value: { value: 42n } },
                { value: { value: 'ambiguous' } },
            ],
        })
    })

    it('parses a function call with labels', () => {
        const input = 'foo(x: 42, y: ambiguous)'
        const errorReporter = new TestErrorReporter()
        const tokenStream = TokenStream.read(input, errorReporter)
        const parser = CallFuncParser.create({ errorReporter })
        const result = parser.parse(tokenStream)
        expect(result).toMatchObject({
            baseName: 'foo',
            arguments: [
                { label: 'x', value: { value: 42n } },
                { label: 'y', value: { value: 'ambiguous' } },
            ],
        })
    })
})
