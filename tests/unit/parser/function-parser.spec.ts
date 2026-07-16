import { describe, expect, it } from 'bun:test'
import { TestErrorReporter } from '../../util'
import { TokenStream } from '../../../src/lexer'
import { FunctionParser } from '../../../src/parser/function-parser'
import { ExplicitUniqueValueSet } from '../../../src/model/explicit-value-set'

describe('Function Parser', () => {
    it('parses a function with no parameters and no return type', () => {
        const code = 'func myFunction() {}'

        const result = parseFunction(code)
        expect(result).toMatchObject({
            baseName: 'myFunction',
            parameters: [],
            result: undefined,
            implementation: { kind: 'body', statements: [] },
        })
    })

    it('parses a function with default-labeled parameters', () => {
        const code = 'func myFunction(x: integer, y: truthvalue) {}'

        const result = parseFunction(code)
        expect(result).toMatchObject({
            baseName: 'myFunction',
            parameters: [
                {
                    varName: 'x',
                    valueSet: { max: undefined, min: undefined },
                    label: 'x',
                    span: {
                        start: { line: 1, column: 17 },
                        end: { line: 1, column: 27 },
                    },
                },
                {
                    varName: 'y',
                    valueSet: { values: ['false', 'ambiguous', 'true'] },
                    label: 'y',
                    span: {
                        start: { line: 1, column: 29 },
                        end: { line: 1, column: 42 },
                    },
                },
            ],
            result: undefined,
            implementation: { kind: 'body', statements: [] },
        })
    })

    it('parses a function with labeled parameters', () => {
        const code = 'func myFunction(_ x: integer, label y: truthvalue) {}'

        const result = parseFunction(code)
        expect(result).toMatchObject({
            baseName: 'myFunction',
            parameters: [
                {
                    varName: 'x',
                    valueSet: { max: undefined, min: undefined },
                    label: undefined,
                    span: {
                        start: { line: 1, column: 17 },
                        end: { line: 1, column: 29 },
                    },
                },
                {
                    varName: 'y',
                    valueSet: { values: ['false', 'ambiguous', 'true'] },
                    label: 'label',
                    span: {
                        start: { line: 1, column: 31 },
                        end: { line: 1, column: 50 },
                    },
                },
            ],
            result: undefined,
            implementation: { kind: 'body', statements: [] },
        })
    })

    it('parses parameters with semantics', () => {
        const code =
            'func myFunction(ref _ x: MyData, const label y: truthvalue) {}'

        const result = parseFunction(code)
        expect(result).toMatchObject({
            baseName: 'myFunction',
            parameters: [
                {
                    varName: 'x',
                    semantics: 'ref',
                    span: {
                        start: { line: 1, column: 17 },
                        end: { line: 1, column: 32 },
                    },
                },
                {
                    varName: 'y',
                    valueSet: { values: ['false', 'ambiguous', 'true'] },
                    semantics: 'const',
                    span: {
                        start: { line: 1, column: 34 },
                        end: { line: 1, column: 59 },
                    },
                },
            ],
            result: undefined,
            implementation: { kind: 'body', statements: [] },
        })
    })

    it('parses a function with inferred-type default-valued parameters', () => {
        const code = 'func myFunction(const _ x = 42) {}'

        const result = parseFunction(code)
        expect(result).toMatchObject({
            baseName: 'myFunction',
            parameters: [
                {
                    varName: 'x',
                    valueSet: undefined,
                    label: undefined,
                    defaultValue: { value: 42n },
                    span: {
                        start: { line: 1, column: 17 },
                        end: { line: 1, column: 31 },
                    },
                },
            ],
            result: undefined,
            implementation: { kind: 'body', statements: [] },
        })
    })

    it('parses a function with an integer return type', () => {
        const code = 'func myFunction() -> integer { return 42 }'

        const result = parseFunction(code)
        expect(result).toMatchObject({
            baseName: 'myFunction',
            parameters: [],
            result: { max: undefined, min: undefined },
            implementation: {
                kind: 'body',
                statements: [{ value: { value: 42n } }],
            },
        })
    })

    it('parses a function with implicit return', () => {
        const code = 'func myFunction() => 42'

        const result = parseFunction(code)
        expect(result).toMatchObject({
            baseName: 'myFunction',
            parameters: [],
            result: undefined,
            implementation: {
                kind: 'implicit-return',
                expression: { value: 42n },
            },
        })
    })

    it('parses a function with a UNIQUE return type', () => {
        const code = 'func myFunction() -> MyData { return {} }'

        const result = parseFunction(code)
        expect(result).toMatchObject({
            baseName: 'myFunction',
            parameters: [],
            result: { typeName: 'MyData' },
        })

        expect(result.result).toBeInstanceOf(ExplicitUniqueValueSet)
    })

    it('parses a function with a COW return type', () => {
        const code = 'func myFunction() -> const MyData { return {} }'

        const result = parseFunction(code)
        expect(result).toMatchObject({
            baseName: 'myFunction',
            parameters: [],
            result: { typeName: 'MyData', semantics: 'const' },
        })
    })

    it('parses a function with a REF return type', () => {
        const code = 'func myFunction() -> ref MyData { return {} }'

        const result = parseFunction(code)
        expect(result).toMatchObject({
            baseName: 'myFunction',
            parameters: [],
            result: { typeName: 'MyData', semantics: 'ref' },
        })
    })
})

function parseFunction(code: string) {
    const errorReporter = new TestErrorReporter()
    const stream = TokenStream.read(code, errorReporter)
    const parser = FunctionParser.create({
        errorReporter,
    })
    return parser.parse(stream)
}
