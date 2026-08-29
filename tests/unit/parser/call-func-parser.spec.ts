import { describe, it, expect } from 'bun:test'
import { TokenStream } from '@/lexer'
import { TestErrorReporter } from '@@/util'
import { CallFuncParser } from '@/parser/call-func-parser'

describe('CallFunc Parser', () => {
    it('parses a simple function call', () => {
        const input = 'foo(42, ambiguous)'
        const errorReporter = new TestErrorReporter()
        const tokenStream = TokenStream.read(input, errorReporter)
        const parser = CallFuncParser.create({ errorReporter })
        const result = parser.parse(tokenStream)
        expect(result).toMatchObject({
            name: { baseName: 'foo', labels: [] },
            arguments: [
                { value: { min: 42n, max: 42n } },
                { value: { values: ['ambiguous'] } },
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
            name: { baseName: 'foo', labels: ['x', 'y'] },
            arguments: [
                { value: { max: 42n, min: 42n } },
                { value: { values: ['ambiguous'] } },
            ],
        })
    })
})
