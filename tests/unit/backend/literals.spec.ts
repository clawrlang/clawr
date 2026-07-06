import { describe, expect, it, test } from 'bun:test'
import { Expression } from '../../../src/cir'
import { lowerExpr } from '../../../src/backend'

describe('Lowering Literals', () => {
    it('lowers string literals correctly', () => {
        const expr: Expression = {
            kind: 'STRING_LITERAL',
            value: 'Hello, World!',
            valueSet: { type: 'string' },
        }
        const result = lowerExpr(expr)
        expect(result).toBe('"Hello, World!"')
    })

    it('lowers integer literals correctly', () => {
        const expr: Expression = {
            kind: 'INTEGER_LITERAL',
            value: '42',
            valueSet: { type: 'integer', min: '42', max: '42' },
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
                    valueSet: {
                        type: 'truthvalue',
                        values: [input as 'false' | 'ambiguous' | 'true'],
                    },
                }
                const result = lowerExpr(expr)
                expect(result).toBe(expected)
            })
        }
    })
})
