import { describe, expect, it, test } from 'bun:test'
import { Expression } from '../../../src/cir'
import { lowerExpr } from '../../../src/backend'
import { ISOLATED } from '../../../src/model/isolation-level'
import { truthvalue } from '../../../src/model/lattice'

describe('Lowering Literals', () => {
    it('lowers string literals correctly', () => {
        const expr: Expression = {
            kind: 'STRING_LITERAL',
            value: { type: 'string', value: 'Hello, World!' },
        }
        const result = lowerExpr(expr)
        expect(result).toBe('"Hello, World!"')
    })

    it('lowers integer literals correctly', () => {
        const expr: Expression = {
            kind: 'INTEGER_LITERAL',
            value: { type: 'integer', max: '42', min: '42' },
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
                    value: {
                        type: 'truthvalue',
                        values: [input as truthvalue],
                    },
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
                isolationLevel: ISOLATED,
                fields: [
                    {
                        name: 'field',
                        value: {
                            kind: 'VARIABLE_REF',
                            name: 'var',
                            value: { type: 'rc-type', name: 'MyType' },
                        },
                    },
                ],
                value: { type: 'rc-type', name: 'MyData' },
            }
            const result = lowerExpr(expr)
            expect(result).toContain('allocInitRC(MyData, 0,')
            expect(result).toContain('.field = var')
        })

        it('lowers as allocInitInheritedRC', () => {
            const expr: Expression = {
                kind: 'ALLOCATION',
                isolationLevel: ISOLATED,
                fields: [
                    {
                        name: 'field',
                        value: {
                            kind: 'VARIABLE_REF',
                            name: 'var',
                            value: { type: 'integer', max: '42', min: '42' },
                        },
                    },
                ],
                base: { name: 'Super' },
                value: { type: 'rc-type', name: 'MyObject' },
            }
            const result = lowerExpr(expr)
            expect(result).toContain('allocInitInheritedRC(MyObject, 0, Super')
            expect(result).toContain('.field = var')
        })
    })
})
