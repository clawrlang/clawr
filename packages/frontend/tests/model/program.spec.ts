import { Scope } from '@/model/scope'
import { parseProgram } from '@/program'
import { createStandardLibraryScope } from '@/stdlib'
import { SourceError, SourceErrorCollection } from '@/tools'
import { describe, expect, it } from 'bun:test'

function compile(sources: { name: string; source: string }[]) {
    const scope = Scope.createRoot(createStandardLibraryScope())
    return parseProgram(sources, scope).toCIR({ scope })
}

describe('field value semantics', () => {
    const compileMain = (body: string) =>
        compile([{ name: 'fields.clawr', source: `@main { ${body} }` }])

    it('rejects invalid literals, incompatible widths and ternary XOR', () => {
        expect(() => compileMain('const a = bitfield("T")')).toThrow(
            'Invalid bitfield lane',
        )
        expect(() =>
            compileMain('const a: bitfield(4) = bitfield("1")'),
        ).toThrow('Incompatible initial value')
        expect(() =>
            compileMain('const a = bitfield("1") & bitfield("10")'),
        ).toThrow('equal lengths')
        expect(() =>
            compileMain('const a = tritfield("1") ^ tritfield("1")'),
        ).toThrow('XOR requires binary')
        expect(() => compileMain('const a = bitfield("1") << -1')).toThrow(
            'cannot be negative',
        )
        expect(() =>
            compileMain('const a = bitfield("1") == tritfield("1")'),
        ).toThrow('same kind')
    })

    it('keeps exponentiation and recognizes field shift and pointwise precedence', () => {
        const module = compileMain(`
            const a = bitfield("1001")
            const b = bitfield("1010")
            const result = a & b ^ b
            const shifted = a << 1 + 1
            const power = 2 ^ 3 ^ 2
        `)
        expect(module.startBlock).toMatchObject([
            {
                kind: 'VARIABLE_DECL',
                type: { universe: 'bitfield', length: 4 },
                initialValue: { kind: 'FIELD_FROM_STRING' },
            },
            {
                kind: 'VARIABLE_DECL',
                type: { universe: 'bitfield', length: 4 },
            },
            {
                kind: 'VARIABLE_DECL',
                initialValue: {
                    kind: 'FIELD_AND',
                    right: { kind: 'FIELD_XOR' },
                },
            },
            {
                kind: 'VARIABLE_DECL',
                initialValue: {
                    kind: 'FIELD_SHIFT_LEFT',
                    right: { kind: 'ADDITION' },
                },
            },
            {
                kind: 'VARIABLE_DECL',
                initialValue: { kind: 'POWER', right: { kind: 'POWER' } },
            },
        ])
    })

    it('does not shadow existing functions with field builtin names', () => {
        expect(() =>
            compile([
                {
                    name: 'shadow.clawr',
                    source: 'func fieldLength(_ x: integer) -> integer => x @main { print(fieldLength(1)) }',
                },
            ]),
        ).not.toThrow()
    })

    it('rejects a statically incompatible field in a data property', () => {
        expect(() =>
            compile([
                {
                    name: 'property.clawr',
                    source: 'data D { lanes: bitfield(4) } @main { const x: D = { lanes: bitfield("1") } }',
                },
            ]),
        ).toThrow('Incompatible field value')
    })
})

describe('multi-file programs', () => {
    it('resolves functions declared in another file in either order', () => {
        const first = {
            name: 'first.clawr',
            source: 'func first() => second() @main { print(first()) }',
        }
        const second = { name: 'second.clawr', source: 'func second() => 42' }
        const userFunctions = (sources: (typeof first)[]) =>
            compile(sources).declarations?.filter(
                (decl) => decl.kind === 'FUNCTION_DECL' && !decl.namespace,
            )
        expect(userFunctions([first, second])).toHaveLength(2)
        expect(userFunctions([second, first])).toHaveLength(2)
    })

    it('requires exactly one main, including empty blocks', () => {
        expect(() => compile([{ name: 'a', source: 'func f() => 1' }])).toThrow(
            'No @main',
        )
        expect(() =>
            compile([
                { name: 'a', source: '@main {}' },
                { name: 'b', source: '@main {}' },
            ]),
        ).toThrow('Multiple @main')
    })

    it('reports the source of a semantic error in another file', () => {
        try {
            compile([
                { name: 'a', source: '@main {}' },
                { name: 'b', source: 'func f() { missing() }' },
            ])
            throw new Error('Expected an error')
        } catch (error) {
            expect(error).toBeInstanceOf(SourceErrorCollection)
            expect(
                (error as SourceErrorCollection).errors[0].span.start.source,
            ).toBe('b')
        }
    })

    it('rejects duplicate functions while permitting overloads', () => {
        const main = { name: 'a', source: 'func f() => 1 @main {}' }
        expect(() =>
            compile([main, { name: 'b', source: 'func f() => 2' }]),
        ).toThrow('Duplicate declaration')
        expect(() =>
            compile([main, { name: 'b', source: 'func f(_ x: integer) => x' }]),
        ).not.toThrow()
    })

    it('reports duplicate entry points at the second source', () => {
        try {
            compile([
                { name: 'a', source: '@main {}' },
                { name: 'b', source: '@main {}' },
            ])
            throw new Error('Expected an error')
        } catch (error) {
            expect(error).toBeInstanceOf(SourceError)
            expect((error as SourceError).span.start.source).toBe('b')
        }
    })

    it('resolves named aliases only after their declaration', () => {
        const definition = {
            name: 'types',
            source: 'subset Count = integer(0...10)',
        }
        const use = {
            name: 'main',
            source: '@main { const value: Count = 2 print(value) }',
        }
        expect(() => compile([definition, use])).not.toThrow()
        expect(() => compile([use, definition])).toThrow()
    })

    it('resolves extensions and rejects duplicate methods across source files', () => {
        expect(() =>
            compile([
                { name: 'type', source: 'data Point { x: integer }' },
                {
                    name: 'extension',
                    source: 'extension Point { func xValue() => self->x }',
                },
                {
                    name: 'main',
                    source: '@main { const point: Point = { x: 1 } point.xValue() }',
                },
            ]),
        ).not.toThrow()
        expect(() =>
            compile([
                { name: 'type', source: 'data Point {}' },
                {
                    name: 'first',
                    source: 'extension Point { func value() => 1 }',
                },
                {
                    name: 'second',
                    source: 'extension Point { func value() => 2 }',
                },
                { name: 'main', source: '@main {}' },
            ]),
        ).toThrow('Duplicate extension method')
    })
})

describe('string value semantics', () => {
    it('accepts explicit, inferred, and aliased string results from storage and calls', () => {
        expect(() =>
            compile([
                {
                    name: 'strings.clawr',
                    source: `
                        type Text = string
                        extern func text() -> string
                        func inferred(_ value: Text) => value
                        func explicit(_ value: Text) -> Text { return inferred(value) }
                        func fromTrait(_ value: HasStringRepresentation) -> string =>
                            value.stringRepresentation()
                        object EmailAddress {
                            func value() -> isolated string => self->value
                            state: const value: Text
                        }
                        @main {
                            const a: isolated string = explicit(text())
                            const b: string = fromTrait(42)
                            print(a)
                            print(b)
                        }
                    `,
                },
            ]),
        ).not.toThrow()
    })

    it('rejects shared string annotations and inferred ref conversions', () => {
        for (const source of [
            'extern func f(_ value: ref string) @main {}',
            'extern func f() -> ref string @main {}',
            'trait T { func f() -> ref string } @main {}',
            'data Box { value: ref string } @main {}',
            'type Text = string extern func f(_ value: ref Text) @main {}',
            'type Text = string extern func f() -> ref Text @main {}',
            'type Text = string object Box { state: value: ref Text } @main {}',
            'extern func text() -> string @main { const x: ref string = text() }',
            'extern func text() -> string @main { const x = text() as ref }',
        ]) {
            expect(() => compile([{ name: 'strings.clawr', source }])).toThrow(
                'A string value cannot be shared with ref',
            )
        }
    })
})
