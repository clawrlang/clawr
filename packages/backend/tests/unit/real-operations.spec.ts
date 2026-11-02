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

        expect(lowerExpr(expr)).toMatch(/Real¸add\(tmpˇ\d+, tmpˇ\d+, 3\)/)
    })

    it('uses explicit float32 arithmetic helpers for binary32 operands', () => {
        const type = {
            universe: 'real' as const,
            min: '-340282346638528859811704183484516925440',
            max: '340282346638528859811704183484516925440',
            precision: {
                kind: 'sig' as const,
                digits: 24,
                base: 'bin' as const,
            },
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

        expect(lowerExpr(expr)).toBe(
            'Real32¸add(strtof("1.25", NULL), strtof("2.5", NULL))',
        )
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

        expect(lowerExpr(expr)).toMatch(/Real¸compare\(tmpˇ\d+, tmpˇ\d+\) < 0/)
    })

    const binaryType = (digits: number, max: string) => ({
        universe: 'real' as const,
        min: `-${max}`,
        max,
        precision: { kind: 'sig' as const, digits, base: 'bin' as const },
    })

    it('uses float16 helpers and an _Float16 literal for binary16 operands', () => {
        const type = binaryType(11, '65504.0')
        const expr: Expression = {
            kind: 'MULTIPLICATION',
            left: { kind: 'REAL_LITERAL', type: { ...type, value: '1.5' } },
            right: { kind: 'REAL_LITERAL', type: { ...type, value: '2.25' } },
            type: {
                universe: 'real',
                precision: type.precision,
            },
        }

        expect(lowerExpr(expr)).toBe('Real16¸multiply(1.5f16, 2.25f16)')
    })

    it('uses float64 helpers for binary64 operands', () => {
        const type = binaryType(53, '1.7976931348623157e308')
        const expr: Expression = {
            kind: 'DIVISION',
            left: { kind: 'REAL_LITERAL', type: { ...type, value: '1.0' } },
            right: { kind: 'REAL_LITERAL', type: { ...type, value: '4.0' } },
            type: { universe: 'real', precision: type.precision },
        }

        expect(lowerExpr(expr)).toBe(
            'Real64¸divide(strtod("1.0", NULL), strtod("4.0", NULL))',
        )
    })

    it('uses arbitrary-precision runtime values for binary formats without a native C type', () => {
        const type = binaryType(113, '1.0e4932')
        const expr: Expression = {
            kind: 'ADDITION',
            left: { kind: 'REAL_LITERAL', type: { ...type, value: '1.0' } },
            right: { kind: 'REAL_LITERAL', type: { ...type, value: '2.0' } },
            type: { universe: 'real', precision: type.precision },
        }

        expect(lowerExpr(expr)).toMatch(
            /Real¸addBinary\(tmpˇ\d+, tmpˇ\d+, 113\)/,
        )
    })

    it('converts an integer operand to the precision of a sig real', () => {
        const expr: Expression = {
            kind: 'ADDITION',
            left: {
                kind: 'REAL_LITERAL',
                type: {
                    universe: 'real',
                    value: '1.25',
                    precision: { kind: 'sig', digits: 3, base: 'dec' },
                },
            },
            right: {
                kind: 'INTEGER_LITERAL',
                type: { universe: 'integer', value: '2' },
            },
            type: {
                universe: 'real',
                precision: { kind: 'sig', digits: 3, base: 'dec' },
            },
        }

        const lowered = lowerExpr(expr)
        expect(lowered).toMatch(/Real¸add\(tmpˇ\d+, tmpˇ\d+, 3\)/)
    })
})
