import { describe, expect, it } from 'bun:test'
import { TestErrorReporter } from '../../util'
import { TokenStream } from '../../../src/lexer'
import { ModuleParser } from '../../../src/parser/module-parser'

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
            main: [
                {
                    baseName: 'print',
                    args: [{ value: { value: 42n } }],
                },
            ],
        })
    })

    it('parses variable declarations in main body', () => {
        const code = `
            @main {
                const x: int = 10
                mut y: int = 20
                print(x)
                print(y)
            }
        `
        const tokenStream = TokenStream.read(
            code,
            new TestErrorReporter('test.clawr'),
        )
        const parser = ModuleParser.create(tokenStream)
        const result = parser.parse()
        expect(result).toMatchObject({
            main: [
                {
                    semantics: 'const',
                    name: 'x',
                    type: 'int',
                    initialValue: { value: 10n },
                },
                {
                    semantics: 'mut',
                    name: 'y',
                    type: 'int',
                    initialValue: { value: 20n },
                },
                {
                    baseName: 'print',
                    args: [{ value: { name: 'x' } }],
                },
                {
                    baseName: 'print',
                    args: [{ value: { name: 'y' } }],
                },
            ],
        })
    })

    it('parses data declarations in global scope', () => {
        const code = 'data MyData { }'
        const tokenStream = TokenStream.read(
            code,
            new TestErrorReporter('test.clawr'),
        )
        const parser = ModuleParser.create(tokenStream)
        const result = parser.parse()
        expect(result).toMatchObject({
            declarations: [{ name: 'MyData' }],
        })
    })

    it('parses data declarations and main in the same module', () => {
        const code = `
            data MyData { }
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
            declarations: [{ name: 'MyData' }],
            main: [{ baseName: 'print' }],
        })
    })
})
