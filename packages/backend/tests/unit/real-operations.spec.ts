import { lowerExpr } from '@clawr/backend'
import { Expression } from '@clawr/cir'
import { describe, expect, it } from 'bun:test'

describe('Lowering real operations', () => {
    it('passes the higher decimal operand precision to each runtime operation', () => {
        const left: Expression = {
            kind: 'REAL_LITERAL',
            type: {
                universe: 'real',
                value: '1.2',
                precision: { kind: 'sig', digits: 2, base: 'dec' },
            },
        }
        const right: Expression = {
            kind: 'REAL_LITERAL',
            type: {
                universe: 'real',
                value: '3.45',
                precision: { kind: 'sig', digits: 3, base: 'dec' },
            },
        }
        const expr: Expression = {
            kind: 'ADDITION',
            left,
            right,
            type: {
                universe: 'real',
                precision: { kind: 'sig', digits: 3, base: 'dec' },
            },
        }

        expect(lowerExpr(expr)).toMatch(
            /Real¸add\(tmpˇ\d+, tmpˇ\d+, 3\)/,
        )
    })

    it('uses explicit float32 arithmetic helpers for binary32 operands', () => {
        const type = {
            universe: 'real' as const,
            min: '-340282346638528859811704183484516925440',
            max: '340282346638528859811704183484516925440',
            precision: { kind: 'sig' as const, digits: 24, base: 'bin' as const },
        }
        const expr: Expression = {
            kind: 'ADDITION',
            left: { kind: 'REAL_LITERAL', type: { ...type, value: '1.25' } },
            right: { kind: 'REAL_LITERAL', type: { ...type, value: '2.5' } },
            type: {
                universe: 'real',
                precision: { kind: 'sig', digits: 24, base: 'bin' },
            },
        }

        expect(lowerExpr(expr)).toBe('Real32¸add(strtof("1.25", NULL), strtof("2.5", NULL))')
    })

    it('compares decimal values without reducing them to a common precision', () => {
        const expr: Expression = {
            kind: 'LESS_THAN',
            left: {
                kind: 'REAL_LITERAL',
                type: {
                    universe: 'real',
                    value: '1.2',
                    precision: { kind: 'sig', digits: 2, base: 'dec' },
                },
            },
            right: {
                kind: 'REAL_LITERAL',
                type: {
                    universe: 'real',
                    value: '1.21',
                    precision: { kind: 'sig', digits: 3, base: 'dec' },
                },
            },
            type: { universe: 'truthvalue', values: ['false', 'true'] },
        }

        expect(lowerExpr(expr)).toMatch(
            /Real¸compare\(tmpˇ\d+, tmpˇ\d+\) < 0/,
        )
    })
})
