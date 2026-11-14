import { TokenStream } from '@/lexer'
import { Scope } from '@/model/scope'
import { ModuleParser } from '@/parser/module-parser'
import { createStandardLibraryScope } from '@/stdlib'
import { describe, expect, it } from 'bun:test'

function compile(source: string) {
    const scope = Scope.createRoot(createStandardLibraryScope())
    return ModuleParser.create({ scope })
        .parse(TokenStream.read(source))
        .toCIR({ scope })
}

const equatable = `
    func equals(_ other: Item) -> boolean { return true }
`
const ordered = `
    func isOrderedBefore(_ other: Item) -> boolean { return false }
`
const object = (traits: string, methods: string) => `
    object Item${traits ? `: ${traits}` : ''} {
        ${methods}
    init:
        func new() => {}
    }
`
const compare = (operator: string) => `
    @main {
        const a: Item = {Item.new()}
        const b: Item = {Item.new()}
        print(a ${operator} b)
    }
`

describe('trait comparisons', () => {
    it('resolves Self and emits all operators with their precise result sets', () => {
        const cir = compile(`
            ${object('Equatable, Ordered', equatable + ordered)}
            @main {
                const a: Item = {Item.new()}
                const b: Item = {Item.new()}
                print(a == b)
                print(a != b)
                print(a < b)
                print(a > b)
                print(a <= b)
                print(a >= b)
            }
        `)
        const scopes = (cir.startBlock ?? []).flatMap((statement) =>
            statement.kind === 'VARIABLE_DECL' &&
            statement.initialValue.kind === 'BOX' &&
            statement.initialValue.expression.kind === 'SCOPE'
                ? [statement.initialValue.expression]
                : [],
        )
        expect(scopes).toHaveLength(6)
        const method = (baseName: string) => ({
            kind: 'CALL',
            name: { baseName },
            receiver: { dispatch: 'direct' },
        })
        const inclusiveComparison = {
            kind: 'SCOPE',
            statements: [
                { initialValue: method('equals') },
                {
                    kind: 'IF',
                    then: [
                        {
                            value: {
                                kind: 'OR',
                                right: method('isOrderedBefore'),
                            },
                        },
                    ],
                },
            ],
        }
        expect(scopes.map((scope) => scope.value)).toMatchObject([
            method('equals'),
            { kind: 'NOT_EQUAL', left: method('equals') },
            method('isOrderedBefore'),
            method('isOrderedBefore'),
            inclusiveComparison,
            inclusiveComparison,
        ])
        for (const scope of scopes) {
            expect(scope.type).toEqual({
                universe: 'truthvalue',
                values: ['false', 'true'],
            })
            expect(scope.statements).toHaveLength(2)
            expect(scope.cleanup).toHaveLength(2)
        }
        const [left, right] = scopes[3].statements
        if (left.kind !== 'VARIABLE_DECL' || right.kind !== 'VARIABLE_DECL')
            throw new Error('Expected operand declarations')
        expect(scopes[3].value).toMatchObject({
            receiver: { object: { name: right.name } },
            arguments: [{ name: left.name }],
        })
        const [inclusiveLeft, inclusiveRight] = scopes[5].statements
        if (
            inclusiveLeft.kind !== 'VARIABLE_DECL' ||
            inclusiveRight.kind !== 'VARIABLE_DECL'
        )
            throw new Error('Expected operand declarations')
        expect(scopes[5].value).toMatchObject({
            statements: [
                {
                    initialValue: {
                        receiver: { object: { name: inclusiveLeft.name } },
                        arguments: [{ name: inclusiveRight.name }],
                    },
                },
                {
                    then: [
                        {
                            value: {
                                right: {
                                    receiver: {
                                        object: { name: inclusiveRight.name },
                                    },
                                    arguments: [{ name: inclusiveLeft.name }],
                                },
                            },
                        },
                    ],
                },
            ],
        })
    })

    it('requires the relevant canonical traits', () => {
        expect(() =>
            compile(object('Equatable', equatable) + compare('==')),
        ).not.toThrow()
        expect(() =>
            compile(object('Ordered', ordered) + compare('<')),
        ).not.toThrow()
        expect(() =>
            compile(object('Equatable', equatable) + compare('<')),
        ).toThrow('must conform to clawr.Ordered')
        expect(() =>
            compile(object('Ordered', ordered) + compare('==')),
        ).toThrow('must conform to clawr.Equatable')
        expect(() =>
            compile(object('Ordered', ordered) + compare('<=')),
        ).toThrow('must conform to clawr.Equatable')
        expect(() =>
            compile(object('Equatable', equatable) + compare('>=')),
        ).toThrow('must conform to clawr.Ordered')
        expect(() =>
            compile(`
                trait Equatable { func equals(_ other: Self) -> boolean }
                ${object('Equatable', equatable)}
                ${compare('==')}
            `),
        ).toThrow('must conform to clawr.Equatable')
    })

    it('keeps primitive comparisons as binary CIR operations', () => {
        const cir = compile(`
            func less(_ a: real sig 24 bin, _ b: real sig 24 bin) -> boolean {
                return a < b
            }
            func equal(_ a: integer, _ b: integer) -> boolean {
                return a == b
            }
        `)
        expect(cir.declarations).toMatchObject([
            { body: [{ kind: 'RETURN', value: { kind: 'LESS_THAN' } }] },
            { body: [{ kind: 'RETURN', value: { kind: 'EQUAL' } }] },
        ])
    })

    it('rejects incorrect Self signatures and overly broad equality results', () => {
        expect(() =>
            compile(
                object(
                    'Equatable',
                    'func equals(_ other: Different) -> boolean { return true }',
                ),
            ),
        ).toThrow('must have the same signature')
        expect(() =>
            compile(
                object(
                    'Equatable',
                    'func equals(_ other: Item) -> truthvalue { return ambiguous }',
                ),
            ),
        ).toThrow('must have the same signature')
    })

    it('substitutes Self in user-defined trait parameters and results', () => {
        expect(() =>
            compile(`
                trait Identity {
                    func identity(_ other: Self) -> Self
                }
                object Item: Identity {
                    func identity(_ other: ref Item) -> ref Item {
                        return other
                    }
                }
            `),
        ).not.toThrow()
        expect(() =>
            compile(`
                func compare(_ a: Equatable, _ b: Equatable) -> boolean {
                    return a.equals(b)
                }
            `),
        ).toThrow(
            'Methods involving Self cannot be called on a trait-typed value',
        )
    })

    it('rejects different concrete types and trait-typed operands', () => {
        expect(() =>
            compile(`
                ${object('Equatable', equatable)}
                object Other { init: func new() => {} }
                @main {
                    const a: Item = {Item.new()}
                    const b: Other = {Other.new()}
                    print(a == b)
                }
            `),
        ).toThrow('Comparison requires operands of the same concrete type')
        expect(() =>
            compile(`
                func compare(_ a: Equatable, _ b: Equatable) -> boolean {
                    return a == b
                }
            `),
        ).toThrow('Comparison requires a non-polymorphic concrete object type')
        const inherited = `
            ${object('Equatable', equatable)}
            object Child: Item {}
        `
        expect(() => compile(inherited)).not.toThrow()
        expect(() => compile(inherited + compare('=='))).toThrow(
            'Comparison requires a non-polymorphic concrete object type',
        )
    })

    it('allows isolated truthvalue results but keeps reference isolation checks', () => {
        expect(() =>
            compile(`
                func yes() -> truthvalue { return true }
                func no() -> truthvalue { return false }
                func unknown() -> truthvalue { return ambiguous }
                func compare() -> boolean { return 1 == 2 }
            `),
        ).not.toThrow()
        expect(() =>
            compile(`
                ${object('', '')}
                func bad(_ value: isolated Item) -> Item { return value }
            `),
        ).toThrow('Cannot return an ISOLATED value as UNIQUE')
    })
})
