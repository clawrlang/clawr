import { lowerExpr } from '@clawr/backend'
import { Expression } from '@clawr/cir'
import { ISOLATED } from '@clawr/frontend/model/isolation-level'
import { truthvalue } from '@clawr/frontend/model/value-set'
import { describe, expect, it, test } from 'bun:test'

describe('Lowering Literals', () => {
    it('lowers string literals correctly', () => {
        const expr: Expression = {
            kind: 'STRING_LITERAL',
            domain: { type: 'string', value: 'Hello, World!' },
        }
        const result = lowerExpr(expr)
        expect(result).toBe('"Hello, World!"')
    })

    it('lowers integer literals correctly', () => {
        const expr: Expression = {
            kind: 'INTEGER_LITERAL',
            domain: { type: 'integer', max: '42', min: '42' },
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
                    domain: {
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
                properties: [
                    {
                        name: 'property',
                        value: {
                            kind: 'VARIABLE_REF',
                            name: 'var',
                            domain: { type: 'rc-type', name: 'MyType' },
                        },
                    },
                ],
                domain: { type: 'rc-type', name: 'MyData' },
            }
            const result = lowerExpr(expr)
            expect(result).toContain('allocInitRC(MyData, 0,')
            expect(result).toContain('.property = var')
        })

        it('lowers as allocInitRC', () => {
            const expr: Expression = {
                kind: 'ALLOCATION',
                isolationLevel: ISOLATED,
                properties: [
                    {
                        name: 'property',
                        value: {
                            kind: 'VARIABLE_REF',
                            name: 'var',
                            domain: { type: 'integer', max: '42', min: '42' },
                        },
                    },
                ],
                domain: { type: 'rc-type', name: 'MyObject' },
            }
            const result = lowerExpr(expr)
            expect(result).toContain('allocInitRC(MyObject, 0')
            expect(result).toContain('.property = var')
        })
    })
})
