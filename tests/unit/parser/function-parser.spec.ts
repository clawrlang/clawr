import { describe, expect, it } from 'bun:test'
import { TestErrorReporter } from '../../util'
import { TokenStream } from '../../../src/lexer'
import { FunctionParser } from '../../../src/parser/function-parser'

describe('Function Parser', () => {
    it('parses a function with no parameters and no return type', () => {
        const code = 'func myFunction() {}'

        const result = parseFunction(code)
        expect(result).toMatchObject({
            name: 'myFunction',
            parameters: [],
            returnValueSet: undefined,
            body: [],
        })
    })

    it('parses a function with default-labeled parameters', () => {
        const code = 'func myFunction(x: integer, y: truthvalue) {}'

        const result = parseFunction(code)
        expect(result).toMatchObject({
            name: 'myFunction',
            parameters: [
                { varName: 'x', type: 'integer', label: 'x' },
                { varName: 'y', type: 'truthvalue', label: 'y' },
            ],
            returnValueSet: undefined,
            body: [],
        })
    })

    it('parses a function with labeled parameters', () => {
        const code = 'func myFunction(_ x: integer, label y: truthvalue) {}'

        const result = parseFunction(code)
        expect(result).toMatchObject({
            name: 'myFunction',
            parameters: [
                { varName: 'x', type: 'integer', label: undefined },
                { varName: 'y', type: 'truthvalue', label: 'label' },
            ],
            returnValueSet: undefined,
            body: [],
        })
    })

    it('parses a function with a return type', () => {
        const code = 'func myFunction() -> integer { return 42 }'

        const result = parseFunction(code)
        expect(result).toMatchObject({
            name: 'myFunction',
            parameters: [],
            returnValueSet: { type: 'integer' },
            body: [{ value: { value: 42n } }],
        })
    })

    it('parses a function with implicit return', () => {
        const code = 'func myFunction() => 42'

        const result = parseFunction(code)
        expect(result).toMatchObject({
            name: 'myFunction',
            parameters: [],
            returnValueSet: undefined,
            body: [{ value: { value: 42n } }],
        })
    })
})

function parseFunction(code: string) {
    const errorReporter = new TestErrorReporter()
    const stream = TokenStream.read(code, errorReporter)
    const parser = FunctionParser.create({
        errorReporter: errorReporter,
    })
    const result = parser.parse(stream)
    return result
}
