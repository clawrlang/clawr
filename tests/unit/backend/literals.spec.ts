import { describe, expect, it, test } from 'bun:test'
import { Expression } from '../../../src/cir'
import { lowerExpr } from '../../../src/backend'

describe('Lowering Literals', () => {
    it('lowers string literals correctly', () => {
        const expr: Expression = {
            kind: 'STRING_LITERAL',
            value: 'Hello, World!',
        }
        const result = lowerExpr(expr)
        expect(result).toBe('"Hello, World!"')
    })

    it('lowers integer literals correctly', () => {
        const expr: Expression = {
            kind: 'INTEGER_LITERAL',
            value: '42',
        }
        const result = lowerExpr(expr)
        expect(result).toBe('42')
    })

    describe('lowers truth value literals to C constants', () => {
        const mapping: Record<string, string> = {
            true: 'c_true',
            false: 'c_false',
            ambiguous: 'c_ambiguous',
        }
        for (const [input, expected] of Object.entries(mapping)) {
            test(`${input} -> ${expected}`, () => {
                const expr: Expression = {
                    kind: 'TRUTHVALUE_LITERAL',
                    value: input as 'false' | 'ambiguous' | 'true',
                }
                const result = lowerExpr(expr)
                expect(result).toBe(expected)
            })
        }
    })

    describe('data literals', () => {
        it('lowers as allocInitRC', () => {
            const expr: Expression = {
                kind: 'ALLOCATION',
                semantics: 'ISOLATED',
                type: {
                    name: 'MyData',
                    namespace: undefined,
                },
                fields: [
                    {
                        name: 'field',
                        value: {
                            kind: 'VARIABLE_REF',
                            name: 'var',
                        },
                    },
                ],
            }
            const result = lowerExpr(expr)
            expect(result).toContain('allocInitRC(MyData, 0,')
            expect(result).toContain('.field = var')
        })

        it('lowers as allocInitInheritedRC', () => {
            const expr: Expression = {
                kind: 'ALLOCATION',
                type: {
                    name: 'MyObject',
                    namespace: undefined,
                },
                semantics: 'ISOLATED',
                fields: [
                    {
                        name: 'field',
                        value: {
                            kind: 'VARIABLE_REF',
                            name: 'var',
                        },
                    },
                ],
                base: { name: 'Super' },
            }
            const result = lowerExpr(expr)
            expect(result).toContain('allocInitInheritedRC(MyObject, 0, Super')
            expect(result).toContain('.field = var')
        })
    })
})
