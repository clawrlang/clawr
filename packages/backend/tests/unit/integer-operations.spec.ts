import { lowerExpr } from '@clawr/backend'
import { Expression } from '@clawr/cir'
import { describe, expect, it } from 'bun:test'
import { BooleanSet } from '../../../cir/dist/src/value-set.js'

const literal = (
    value: `${bigint}`,
): Expression & { kind: 'INTEGER_LITERAL' } => ({
    kind: 'INTEGER_LITERAL',
    type: { universe: 'integer', value },
})
const small = { universe: 'integer', min: '0', max: '100' } as const

describe('Lowering integer operations', () => {
    it('uses C operators for native operands', () => {
        const expr: Expression = {
            kind: 'ADDITION',
            left: literal('1'),
            right: literal('2'),
            type: { universe: 'integer', value: '3' },
        }
        expect(lowerExpr(expr)).toBe('(1) + (2)')
    })

    it('uses floored division for native operands', () => {
        const expr: Expression = {
            kind: 'DIVISION',
            left: literal('7'),
            right: literal('2'),
            type: small,
        }
        expect(lowerExpr(expr)).toBe('floorDiv64(7, 2)')
    })

    it('compares native operands as truthvalues', () => {
        const expr = {
            kind: 'LESS_THAN' as const,
            left: literal('1'),
            right: literal('2'),
            type: {
                universe: 'truthvalue',
                values: ['false', 'true'],
            } satisfies BooleanSet,
        }
        expect(lowerExpr(expr)).toBe('((1) < (2) ? c_true : c_false)')
    })

    it('uses Integer functions when an operand exceeds 64 bits', () => {
        const expr = {
            kind: 'GREATER_THAN' as const,
            left: literal('100000000000000000000'),
            right: literal('2'),
            type: {
                universe: 'truthvalue',
                values: ['false', 'true'],
            } satisfies BooleanSet,
        }
        expect(lowerExpr(expr)).toMatch(/^Integer¸gt\(tmpˇ\d+, tmpˇ\d+\)$/)
    })
})
