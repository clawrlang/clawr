import { describe, it, expect } from 'bun:test'
import { TokenStream } from '../../../src/lexer'
import { TestErrorReporter } from '../../util'
import { CallFuncParser } from '../../../src/parser/call-func-parser'

describe('CallFunc Parser', () => {
    it('parses a simple function call', () => {
        const input = 'foo(42, ambiguous)'
        const tokenStream = TokenStream.read(
            input,
            new TestErrorReporter('test.clawr'),
        )
        const parser = CallFuncParser.create(tokenStream)
        const result = parser.parse()
        expect(result).toMatchObject({
            baseName: 'foo',
            args: [
                { value: { value: 42n } },
                { value: { value: 'ambiguous' } },
            ],
        })
    })
})
