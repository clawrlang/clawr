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
        const result = parseModule(code)
        expect(result).toMatchObject({
            main: [
                {
                    name: { baseName: 'print', arity: 1, labels: [] },
                    arguments: [{ value: 42n }],
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
        const result = parseModule(code)
        expect(result).toMatchObject({
            main: [
                {
                    semantics: 'const',
                    name: 'x',
                    valueSet: {
                        min: undefined,
                        max: undefined,
                    },
                    initialValue: { value: 10n },
                },
                {
                    semantics: 'mut',
                    name: 'y',
                    valueSet: {
                        min: undefined,
                        max: undefined,
                    },
                    initialValue: { value: 20n },
                },
                {
                    name: { baseName: 'print', arity: 1, labels: [] },
                    arguments: [{ name: 'x' }],
                },
                {
                    name: { baseName: 'print', arity: 1, labels: [] },
                    arguments: [{ name: 'y' }],
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
        const result = parseModule(code)
        expect(result).toMatchObject({
            main: [
                {
                    semantics: 'mut',
                    name: 'y',
                    valueSet: {
                        min: undefined,
                        max: undefined,
                    },
                    initialValue: { value: 20n },
                },
                {
                    target: { name: 'y' },
                    value: { value: 30n },
                },
                {
                    name: { baseName: 'print', arity: 1, labels: [] },
                    arguments: [{ name: 'y' }],
                },
            ],
        })
    })

    it('parses data declarations in global scope', () => {
        const code = 'data MyData { }'
        const result = parseModule(code)
        expect(result).toMatchObject({
            declarations: [{ name: { name: 'MyData' } }],
        })
    })

    it('parses object declarations in global scope', () => {
        const code = 'object MyObject { }'
        const result = parseModule(code)
        expect(result).toMatchObject({
            declarations: [{ name: 'MyObject' }],
        })
    })

    it('parses service declarations in global scope', () => {
        const code = 'service MyService { }'
        const result = parseModule(code)
        expect(result).toMatchObject({
            declarations: [{ name: 'MyService' }],
        })
    })

    it('parses variable declarations in global scope', () => {
        const code = 'const x: integer = 10'
        const result = parseModule(code)
        expect(result).toMatchObject({
            declarations: [{ name: 'x' }],
        })
    })

    it('parses function declarations in global scope', () => {
        const code = `
            func add(a: integer) -> integer {
                return a
            }
            `
        const result = parseModule(code)
        expect(result).toMatchObject({
            declarations: [
                {
                    baseName: 'add',
                },
            ],
        })
    })

    it('parses data declarations and main in the same module', () => {
        const code = `
            data MyData { }
            @main {
                print(42)
            }
            `
        const result = parseModule(code)
        expect(result).toMatchObject({
            declarations: [{ name: { name: 'MyData' } }],
            main: [
                {
                    name: { baseName: 'print', arity: 1, labels: [] },
                    arguments: [{ value: 42n }],
                },
            ],
        })
    })
})

function parseModule(code: string) {
    const errorReporter = new TestErrorReporter()
    const tokenStream = TokenStream.read(code, errorReporter)
    const parser = ModuleParser.create({ errorReporter })
    return parser.parse(tokenStream)
}
