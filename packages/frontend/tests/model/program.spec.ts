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

    it('infers exact field literal widths and lowers canonical lane strings', () => {
        const module = compileMain(`
            const bits = 0b000_1
            const trits = 0tT01_T01_T01
            const hex = 0x0F
            const alphabet = 0x0123456789aBcDeF
        `)
        expect(module.startBlock).toMatchObject(
            [
                ['bitfield', 4, '0001'],
                ['tritfield', 9, 'T01T01T01'],
                ['bitfield', 8, '00001111'],
                [
                    'bitfield',
                    64,
                    '0000000100100011010001010110011110001001101010111100110111101111',
                ],
            ].map(([universe, length, value]) => ({
                kind: 'VARIABLE_DECL',
                type: { universe, length },
                initialValue: {
                    kind: 'FIELD_FROM_STRING',
                    type: { universe, length },
                    value: { kind: 'STRING_LITERAL', type: { value } },
                },
            })),
        )
    })

    it.each([
        'const a: bitfield(3) = 0b0001',
        'const a: tritfield(2) = 0tT01',
        'const a: bitfield(2) = 0x0F',
        'const a: integer = 0b1',
        'const a: integer = 0xF',
        'const a: tritfield(1) = 0b1',
    ])('rejects incompatible literal types: %s', (body) => {
        expect(() => compileMain(body)).toThrow('Incompatible initial value')
    })

    it.each(['0B10', '0XFF', '0o77'])(
        'does not treat %s as a non-decimal integer literal',
        (literal) => {
            expect(() => compileMain(`const a: integer = ${literal}`)).toThrow()
        },
    )

    it('does not resolve field literals through user-defined constructors', () => {
        const module = compile([
            {
                name: 'shadow.clawr',
                source: `
                    func bitfield(_ x: string) -> integer => 7
                    func tritfield(_ x: string) -> integer => 8
                    @main {
                        const b: bitfield(1) = 0b1
                        const h: bitfield(4) = 0xF
                        const t: tritfield(1) = 0tT
                        const ordinary: integer = bitfield("1")
                    }
                `,
            },
        ])
        expect(module.startBlock).toMatchObject([
            { type: { universe: 'bitfield', length: 1 } },
            { type: { universe: 'bitfield', length: 4 } },
            { type: { universe: 'tritfield', length: 1 } },
            { type: { universe: 'integer' } },
        ])
    })

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

    it('lowers pointwise NOT separately from scalar logical NOT', () => {
        const module = compileMain(`
            const bits = ~0b0001
            const trits = ~0tT01
            const twice = ~~0x0F
            const combined = ~0x0F & 0xFF
            const shifted = ~0x0F << 1
            const xor = ~0x0F ^ 0xFF
            const logical = !ambiguous
        `)
        expect(module.startBlock).toMatchObject([
            {
                type: { universe: 'bitfield', length: 4 },
                initialValue: { kind: 'FIELD_NOT' },
            },
            {
                type: { universe: 'tritfield', length: 3 },
                initialValue: { kind: 'FIELD_NOT' },
            },
            {
                initialValue: {
                    kind: 'FIELD_NOT',
                    operand: { kind: 'FIELD_NOT' },
                },
            },
            {
                initialValue: {
                    kind: 'FIELD_AND',
                    left: { kind: 'FIELD_NOT' },
                },
            },
            {
                initialValue: {
                    kind: 'FIELD_SHIFT_LEFT',
                    left: { kind: 'FIELD_NOT' },
                },
            },
            {
                initialValue: {
                    kind: 'FIELD_XOR',
                    left: { kind: 'FIELD_NOT' },
                },
            },
            {
                type: { universe: 'truthvalue', value: 'ambiguous' },
                initialValue: { kind: 'NOT' },
            },
        ])
    })

    it.each([
        ['!0b1', 'Logical negation requires a truthvalue'],
        ['!0tT01', 'Logical negation requires a truthvalue'],
        ['~true', 'Pointwise negation requires a field'],
        ['~ambiguous', 'Pointwise negation requires a field'],
        ['~1', 'Pointwise negation requires a field'],
        ['~"text"', 'Pointwise negation requires a field'],
    ])('rejects invalid NOT operands: %s', (expression, message) => {
        expect(() => compileMain(`const result = ${expression}`)).toThrow(
            message,
        )
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

    it('lowers lane access, slices and unequal-width concatenation with precise types', () => {
        const module = compileMain(`
            const bits = bitfield("1001")
            const lane = fieldLane(bits, 0)
            const slice: bitfield(2) = fieldSlice(bits, 1, 2)
            const joined: bitfield(3) = fieldConcat(slice, bitfield("1"))
            const empty: bitfield(0) = fieldSlice(bits, 4, 0)
            const trit = fieldLane(tritfield("T01"), 1)
        `)
        expect(module.startBlock).toMatchObject([
            { kind: 'VARIABLE_DECL' },
            {
                kind: 'VARIABLE_DECL',
                initialValue: {
                    kind: 'FIELD_LANE',
                    type: { universe: 'truthvalue', values: ['false', 'true'] },
                },
            },
            {
                kind: 'VARIABLE_DECL',
                initialValue: {
                    kind: 'FIELD_SLICE',
                    type: { universe: 'bitfield', length: 2 },
                },
            },
            {
                kind: 'VARIABLE_DECL',
                initialValue: {
                    kind: 'FIELD_CONCAT',
                    type: { universe: 'bitfield', length: 3 },
                },
            },
            {
                kind: 'VARIABLE_DECL',
                type: { universe: 'bitfield', length: 0 },
            },
            {
                kind: 'VARIABLE_DECL',
                initialValue: {
                    kind: 'FIELD_LANE',
                    type: { universe: 'truthvalue' },
                },
            },
        ])
    })

    it.each([
        ['fieldLane(bitfield("1"), -1)', 'cannot be negative'],
        ['fieldLane(bitfield("1"), 1)', 'out of bounds'],
        ['fieldLane(bitfield(""), 0)', 'out of bounds'],
        ['fieldSlice(bitfield("10"), 3, 0)', 'out of bounds'],
        ['fieldSlice(bitfield("10"), 1, 2)', 'out of bounds'],
        ['fieldSlice(bitfield("10"), 0, -1)', 'cannot be negative'],
        ['fieldSlice(bitfield("10"), -1, 0)', 'cannot be negative'],
        [
            'fieldSlice(bitfield("10"), 0, 10000000000000000000000)',
            'out of bounds',
        ],
        ['fieldLane(bitfield("1"), "0")', 'requires integer'],
        ['fieldSlice(bitfield("1"), 0, "1")', 'requires integer'],
        ['fieldConcat(bitfield("1"), tritfield("1"))', 'same kind'],
        ['fieldSlice(bitfield("1"), 0)', 'expects 3'],
    ])('rejects invalid field manipulation: %s', (expression, message) => {
        expect(() => compileMain(`const result = ${expression}`)).toThrow(
            message,
        )
    })

    it('allows ordinary functions to shadow the new field helpers', () => {
        expect(() =>
            compile([
                {
                    name: 'shadow.clawr',
                    source: `
                func fieldLane(_ a: integer, _ b: integer) => a + b
                func fieldSlice(_ a: integer, _ b: integer, _ c: integer) => a + b + c
                func fieldConcat(_ a: integer, _ b: integer) => a + b
                @main { print(fieldLane(1, 2)) print(fieldSlice(1, 2, 3)) print(fieldConcat(1, 2)) }
            `,
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

    it('allows only one main, including empty blocks', () => {
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
