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
            "1:20:Type mismatch: expected 'integer' but got 'truthvalue'",
        )
    })

    it('fails when declaration has data literal initializer without annotation', () => {
        expect(() => analyze('const p = { x: true }')).toThrow(
            "1:1:Cannot infer type for variable 'p' from 'data-literal' initializer",
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
        expect(() => analyze('const y = x')).toThrow(
            "1:11:Unknown identifier 'x'",
        )
    })

    it('accepts assignment when target and value types match', () => {
        const program = analyze('mut x = ambiguous\nx = true')

        expect(program).toMatchObject({
            body: [
                {
                    kind: 'var-decl',
                    name: 'x',
                    valueSet: { type: 'truthvalue' },
                },
                {
                    kind: 'assign',
                    target: { kind: 'identifier', name: 'x' },
                    value: { kind: 'truthvalue', value: 'true' },
                },
            ],
        })
    })

    it('annotates print dispatch for identifier values', () => {
        const program = analyze('const x = ambiguous\nprint x')

        expect(program).toMatchObject({
            body: [
                {
                    kind: 'var-decl',
                    name: 'x',
                    valueSet: { type: 'truthvalue' },
                },
                {
                    kind: 'print',
                    dispatchType: 'truthvalue',
                },
            ],
        })
    })

    it('annotates print dispatch for truthvalue literal values', () => {
        const program = analyze('print true')

        expect(program).toMatchObject({
            body: [
                {
                    kind: 'print',
                    dispatchType: 'truthvalue',
                },
            ],
        })
    })

    it('fails when assignment target and value types differ', () => {
        expect(() => analyze('mut x = ambiguous\nx = y')).toThrow(
            "2:5:Unknown identifier 'y'",
        )
    })

    it('fails when assignment target type does not match value type', () => {
        expect(() =>
            analyze(
                'data Point {\n  x: truthvalue\n}\nmut p: Point = { x: true }\nmut t = ambiguous\nt = p',
            ),
        ).toThrow(
            "6:1:Assignment type mismatch: target is 'truthvalue' but value is 'Point'",
        )
    })

    it('fails when assignment target is unknown identifier', () => {
        expect(() => analyze('unknown = ambiguous')).toThrow(
            "1:1:Unknown identifier 'unknown'",
        )
    })

    it('fails when field assignment has mismatched known types', () => {
        expect(() =>
            analyze(
                'data Point {\n  x: truthvalue\n}\nmut p: Point = { x: true }\np.x = p',
            ),
        ).toThrow(
            "5:1:Assignment type mismatch: target is 'truthvalue' but value is 'Point'",
        )
    })
})

function analyze(code: string) {
    const stream = new TokenStream(code, 'test.clawr')
    const parser = new Parser(stream)
    const analyzer = new SemanticAnalyzer(parser.parse())
    return analyzer.analyze()
}
