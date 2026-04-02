import { describe, expect, it } from 'bun:test'
import { TokenStream } from '../../src/lexer'
import { Parser } from '../../src/parser'
import { SemanticAnalyzer } from '../../src/semantic-analyzer'

describe('SemanticAnalyzer', () => {
    describe('data field semantics', () => {
        it('accepts ref field with reference-counted type', () => {
            const module = analyze(
                'data Node {\n  ref next: Node\n  value: truthvalue\n}',
            )

            expect(module.types).toMatchObject([
                {
                    kind: 'data-decl',
                    name: 'Node',
                    fields: [
                        { semantics: 'ref', name: 'next', type: 'Node' },
                        { semantics: 'mut', name: 'value', type: 'truthvalue' },
                    ],
                },
            ])
        })

        it('fails when const field semantics is used', () => {
            expect(() =>
                analyze('data Point {\n  const x: truthvalue\n}'),
            ).toThrow(
                "1:1:Field 'x' in data type 'Point' cannot use 'const' semantics",
            )
        })

        it('fails when ref field semantics is used with non-reference type', () => {
            expect(() =>
                analyze('data Point {\n  ref x: truthvalue\n}'),
            ).toThrow(
                "1:1:Field 'x' in data type 'Point' cannot use 'ref' semantics with non-reference type 'truthvalue'",
            )
        })

        it('reports missing field using declaration field position', () => {
            expect(() =>
                analyze(
                    'data Point {\nx: truthvalue\ny: truthvalue\n}\nconst p: Point = { x: true }',
                ),
            ).toThrow("3:1:Missing field 'y' for data type 'Point'")
        })
    })

    describe('variable declaration type inference', () => {
        it('infers declaration type from truthvalue literal', () => {
            const module = analyze('const x = ambiguous')

            expect(module.functions[0].body).toMatchObject([
                {
                    kind: 'var-decl',
                    semantics: 'const',
                    name: 'x',
                    valueSet: { type: 'truthvalue' },
                    value: { kind: 'truthvalue', value: 'ambiguous' },
                },
            ])
        })

        it('keeps explicit declaration type when it matches inferred initializer type', () => {
            const module = analyze('const x: truthvalue = ambiguous')

            expect(module.functions[0].body).toMatchObject([
                {
                    kind: 'var-decl',
                    semantics: 'const',
                    name: 'x',
                    valueSet: { type: 'truthvalue' },
                },
            ])
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
            const module = analyze('const x = ambiguous\nconst y = x')

            expect(module.functions[0].body).toMatchObject([
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
            ])
        })

        it('fails when inferred declaration references unknown identifier', () => {
            expect(() => analyze('const y = x')).toThrow(
                "1:11:Unknown identifier 'x'",
            )
        })

        it('fails when redeclaring a variable in the same scope', () => {
            expect(() => analyze('const x = ambiguous\nmut x = true')).toThrow(
                "2:1:Variable 'x' is already declared in this scope",
            )
        })
    })

    describe('variable assignment', () => {
        it('accepts assignment when target and value types match', () => {
            const module = analyze('mut x = ambiguous\nx = true')

            expect(module.functions[0].body).toMatchObject([
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
            ])
        })

        it('fails when assignment target and value types differ', () => {
            expect(() => analyze('mut x = ambiguous\nx = y')).toThrow(
                "2:5:Unknown identifier 'y'",
            )
        })

        it('fails when assigning to const variable', () => {
            expect(() => analyze('const x = ambiguous\nx = true')).toThrow(
                "2:1:Cannot assign to const variable 'x'",
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
    })

    describe('print statement dispatch annotation', () => {
        it('annotates print dispatch for identifier values', () => {
            const module = analyze('const x = ambiguous\nprint x')

            expect(module.functions[0].body).toMatchObject([
                {
                    kind: 'var-decl',
                    name: 'x',
                    valueSet: { type: 'truthvalue' },
                },
                {
                    kind: 'print',
                    dispatchType: 'truthvalue',
                },
            ])
        })

        it('annotates print dispatch for truthvalue literal values', () => {
            const module = analyze('print true')

            expect(module.functions[0].body).toMatchObject([
                {
                    kind: 'print',
                    dispatchType: 'truthvalue',
                },
            ])
        })
    })

    describe('field access', () => {
        it('converts binary expressions with dot operator into field access expressions', () => {
            const module = analyze(
                'data Point {\n  x: truthvalue\n}\nconst p: Point = { x: true }\nconst x = p.x',
            )

            expect(module.functions[0].body[1]).toMatchObject({
                kind: 'var-decl',
                name: 'x',
                valueSet: { type: 'truthvalue' },
                value: {
                    kind: 'field-access',
                    object: { kind: 'identifier', name: 'p' },
                    field: 'x',
                },
            })
        })

        it('converts dot operator in assignment target into field assignment', () => {
            const module = analyze(
                'data Point {\n  x: truthvalue\n}\nmut p: Point = { x: true }\np.x = true',
            )
            expect(module.types).toMatchObject([
                {
                    kind: 'data-decl',
                    name: 'Point',
                    fields: [{ name: 'x', type: 'truthvalue' }],
                },
            ])
            expect(module.functions[0].body).toMatchObject([
                {
                    kind: 'var-decl',
                    semantics: 'mut',
                    name: 'p',
                    valueSet: { type: 'Point' },
                    value: {
                        kind: 'data-literal',
                        fields: {
                            x: { kind: 'truthvalue', value: 'true' },
                        },
                    },
                },
                {
                    kind: 'assign',
                    target: {
                        kind: 'field-access',
                        object: { kind: 'identifier', name: 'p' },
                        field: 'x',
                    },
                    value: { kind: 'truthvalue', value: 'true' },
                },
            ])
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

        it('fails when mutating field through const variable', () => {
            expect(() =>
                analyze(
                    'data Point {\n  x: truthvalue\n}\nconst p: Point = { x: true }\np.x = false',
                ),
            ).toThrow("5:1:Cannot mutate field through const variable 'p'")
        })
    })

    describe('ownership effects', () => {
        it('annotates reference declaration with retain and release-at-exit effects', () => {
            const module = analyze(
                'data Box {\n  value: truthvalue\n}\nconst other: Box = { value: true }\nconst b: Box = other',
            )

            expect(module.functions[0].body[1]).toMatchObject({
                kind: 'var-decl',
                name: 'b',
                ownership: {
                    releaseAtScopeExit: true,
                    retains: [{ kind: 'identifier', name: 'b' }],
                },
            })
        })

        it('rejects declaration crossing semantics without explicit copy', () => {
            expect(() =>
                analyze(
                    'data Box {\n  value: truthvalue\n}\nref shared: Box = { value: true }\nmut isolated: Box = shared',
                ),
            ).toThrow(
                '5:1:Cross-semantics assignment requires explicit copy(...)',
            )
            expect(() =>
                analyze(
                    'data Box {\n  value: truthvalue\n}\nref shared: Box = { value: true }\nmut isolated: Box = shared',
                ),
            ).toThrow('Use copy(shared) to state intent.')
        })

        it('rejects assignment crossing semantics without explicit copy', () => {
            expect(() =>
                analyze(
                    'data Box {\n  value: truthvalue\n}\nref shared: Box = { value: true }\nmut isolated: Box = { value: true }\nisolated = shared',
                ),
            ).toThrow(
                '6:1:Cross-semantics assignment requires explicit copy(...)',
            )
        })

        it('allows declaration crossing semantics with explicit copy', () => {
            const module = analyze(
                'data Box {\n  value: truthvalue\n}\nref shared: Box = { value: true }\nmut isolated: Box = copy(shared)',
            )

            expect(module.functions[0].body[1]).toMatchObject({
                kind: 'var-decl',
                name: 'isolated',
                value: {
                    kind: 'copy',
                    value: { kind: 'identifier', name: 'shared' },
                },
            })
        })

        it('allows assignment crossing semantics with explicit copy', () => {
            const module = analyze(
                'data Box {\n  value: truthvalue\n}\nref shared: Box = { value: true }\nmut isolated: Box = { value: true }\nisolated = copy(shared)',
            )

            expect(module.functions[0].body[2]).toMatchObject({
                kind: 'assign',
                value: {
                    kind: 'copy',
                    value: { kind: 'identifier', name: 'shared' },
                },
            })
        })

        it('rejects copy(...) for non-reference values', () => {
            expect(() => analyze('mut x = copy(true)')).toThrow(
                "1:9:copy(...) expects a reference-counted value, got 'truthvalue'",
            )
        })

        it('annotates nested field assignment with mutate effects', () => {
            const module = analyze(
                'data Inner {\n  value: truthvalue\n}\ndata Outer {\n  inner: Inner\n}\nconst i: Inner = { value: true }\nmut o: Outer = { inner: i }\no.inner.value = true',
            )

            expect(module.functions[0].body[2]).toMatchObject({
                kind: 'assign',
                ownership: {
                    mutates: [
                        { kind: 'identifier', name: 'o' },
                        {
                            kind: 'field-access',
                            object: { kind: 'identifier', name: 'o' },
                            field: 'inner',
                        },
                    ],
                },
            })
        })
    })

    describe('control-flow semantics', () => {
        it('accepts truthvalue if/while conditions', () => {
            const module = analyze(
                'mut x = true\nif x { print true } else { print false }\nwhile x { break }',
            )

            expect(module.functions[0].body).toMatchObject([
                {
                    kind: 'var-decl',
                    name: 'x',
                    valueSet: { type: 'truthvalue' },
                },
                {
                    kind: 'if',
                    condition: { kind: 'identifier', name: 'x' },
                    thenBranch: [{ kind: 'print' }],
                    elseBranch: [{ kind: 'print' }],
                },
                {
                    kind: 'while',
                    condition: { kind: 'identifier', name: 'x' },
                    body: [{ kind: 'break' }],
                },
            ])
        })

        it('rejects non-truthvalue if condition', () => {
            expect(() =>
                analyze(
                    'data Box { value: truthvalue }\nconst b: Box = { value: true }\nif b { print true }',
                ),
            ).toThrow("3:1:if condition must be truthvalue, got 'Box'")
        })

        it('rejects non-truthvalue while condition', () => {
            expect(() =>
                analyze(
                    'data Box { value: truthvalue }\nconst b: Box = { value: true }\nwhile b { break }',
                ),
            ).toThrow("3:1:while condition must be truthvalue, got 'Box'")
        })

        it('rejects break outside while', () => {
            expect(() => analyze('break')).toThrow(
                '1:1:break is only allowed inside a while loop',
            )
        })

        it('rejects continue outside while', () => {
            expect(() => analyze('continue')).toThrow(
                '1:1:continue is only allowed inside a while loop',
            )
        })
    })
})

function analyze(code: string) {
    const stream = new TokenStream(code, 'test.clawr')
    const parser = new Parser(stream)
    const analyzer = new SemanticAnalyzer(parser.parse())
    return analyzer.analyze()
}
