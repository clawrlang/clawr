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
        const errorReporter = new TestErrorReporter()
        const tokenStream = TokenStream.read(code, errorReporter)
        const parser = ModuleParser.create({ errorReporter })
        const result = parser.parse(tokenStream)
        expect(result).toMatchObject({
            main: [
                {
                    baseName: 'print',
                    arguments: [{ value: { value: 42n } }],
                },
            ],
        })
    })

    it('parses variable declarations in main body', () => {
        const code = `
            @main {
                const x: integer = 10
                mut y: integer = 20
                print(x)
                print(y)
            }
        `
        const errorReporter = new TestErrorReporter()
        const tokenStream = TokenStream.read(code, errorReporter)
        const parser = ModuleParser.create({ errorReporter })
        const result = parser.parse(tokenStream)
        expect(result).toMatchObject({
            main: [
                {
                    semantics: 'const',
                    name: 'x',
                    type: 'integer',
                    initialValue: { value: 10n },
                },
                {
                    semantics: 'mut',
                    name: 'y',
                    type: 'integer',
                    initialValue: { value: 20n },
                },
                {
                    baseName: 'print',
                    arguments: [{ value: { name: 'x' } }],
                },
                {
                    baseName: 'print',
                    arguments: [{ value: { name: 'y' } }],
                },
            ],
        })
    })

    it('parses assignments in main body', () => {
        const code = `
            @main {
                mut y: integer = 20
                y = 30
                print(y)
            }
        `
        const errorReporter = new TestErrorReporter()
        const tokenStream = TokenStream.read(code, errorReporter)
        const parser = ModuleParser.create({ errorReporter })
        const result = parser.parse(tokenStream)
        expect(result).toMatchObject({
            main: [
                {
                    semantics: 'mut',
                    name: 'y',
                    type: 'integer',
                    initialValue: { value: 20n },
                },
                {
                    target: { name: 'y' },
                    value: { value: 30n },
                },
                {
                    baseName: 'print',
                    arguments: [{ value: { name: 'y' } }],
                },
            ],
        })
    })

    it('parses data declarations in global scope', () => {
        const code = 'data MyData { }'
        const errorReporter = new TestErrorReporter()
        const tokenStream = TokenStream.read(code, errorReporter)
        const parser = ModuleParser.create({ errorReporter })
        const result = parser.parse(tokenStream)
        expect(result).toMatchObject({
            declarations: [{ name: 'MyData' }],
        })
    })

    it('parses variable declarations in global scope', () => {
        const code = 'const x: integer = 10'
        const errorReporter = new TestErrorReporter()
        const tokenStream = TokenStream.read(code, errorReporter)
        const parser = ModuleParser.create({ errorReporter })
        const result = parser.parse(tokenStream)
        expect(result).toMatchObject({
            declarations: [{ name: 'x' }],
        })
    })

    it('parses data declarations and main in the same module', () => {
        const code = `
            data MyData { }
            @main {
                print(42)
            }
        `
        const errorReporter = new TestErrorReporter()
        const tokenStream = TokenStream.read(code, errorReporter)
        const parser = ModuleParser.create({ errorReporter })
        const result = parser.parse(tokenStream)
        expect(result).toMatchObject({
            declarations: [{ name: 'MyData' }],
            main: [
                { baseName: 'print', arguments: [{ value: { value: 42n } }] },
            ],
        })
    })
})
