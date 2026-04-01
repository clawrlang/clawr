import { describe, expect, it } from 'bun:test'
import { TokenStream } from '../../src/lexer'
import { Parser } from '../../src/parser'
import { SemanticAnalyzer } from '../../src/semantic-analyzer'

describe('SemanticAnalyzer', () => {
    it('infers declaration type from truthvalue literal', () => {
        const program = analyze('const x = ambiguous')

        expect(program).toMatchObject({
            body: [
                {
                    kind: 'var-decl',
                    semantics: 'const',
                    name: 'x',
                    valueSet: { type: 'truthvalue' },
                    value: { kind: 'truthvalue', value: 'ambiguous' },
                },
            ],
        })
    })

    it('keeps explicit declaration type when it matches inferred initializer type', () => {
        const program = analyze('const x: truthvalue = ambiguous')

        expect(program).toMatchObject({
            body: [
                {
                    kind: 'var-decl',
                    semantics: 'const',
                    name: 'x',
                    valueSet: { type: 'truthvalue' },
                },
            ],
        })
    })

    it('fails on explicit declaration type mismatch', () => {
        expect(() => analyze('const x: integer = ambiguous')).toThrow(
            "Type mismatch: expected 'integer' but got 'truthvalue'",
        )
    })

    it('fails when declaration has data literal initializer without annotation', () => {
        expect(() => analyze('const p = { x: true }')).toThrow(
            "Cannot infer type for variable 'p' from 'data-literal' initializer",
        )
    })

    it('infers declaration type from identifier reference', () => {
        const program = analyze('const x = ambiguous\nconst y = x')

        expect(program).toMatchObject({
            body: [
                {
                    kind: 'var-decl',
                    name: 'x',
                    valueSet: { type: 'truthvalue' },
                },
                {
                    kind: 'var-decl',
                    name: 'y',
                    valueSet: { type: 'truthvalue' },
                },
            ],
        })
    })

    it('fails when inferred declaration references unknown identifier', () => {
        expect(() => analyze('const y = x')).toThrow("Unknown identifier 'x'")
    })
})

function analyze(code: string) {
    const stream = new TokenStream(code, 'test.clawr')
    const parser = new Parser(stream)
    const analyzer = new SemanticAnalyzer(parser.parse())
    return analyzer.analyze()
}
