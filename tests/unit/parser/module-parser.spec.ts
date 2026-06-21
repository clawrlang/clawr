import { describe, expect, it } from 'bun:test'
import { TestErrorReporter } from '../../util'
import { TokenStream } from '../../../src/lexer'
import { ModuleParser } from '../../../src/parser'

describe('Module Parser', () => {
    it('parses a simple main body module', () => {
        const code = `
            @main {
                print(42)
            }
        `
        const tokenStream = TokenStream.read(
            code,
            new TestErrorReporter('test.clawr'),
        )
        const parser = ModuleParser.create(tokenStream)
        const result = parser.parse()
        expect(result).toMatchObject({
            $main: [
                {
                    type: 'CALL_FUNC',
                    signature: {
                        baseName: 'printInteger',
                        parameters: [{ type: 'integer' }],
                    },
                    arguments: [{ type: 'INTEGER_LITERAL', value: '42' }],
                },
            ],
        })
    })
})
