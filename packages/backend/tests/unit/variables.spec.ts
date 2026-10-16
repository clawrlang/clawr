import { lowerExpr, lowerStmt } from '@clawr/backend'
import { Declaration, Expression } from '@clawr/cir'
import { describe, expect, it } from 'bun:test'

describe('Lowering Variables', () => {
    it('lowers variable declarations correctly', () => {
        const decl: Declaration = {
            kind: 'VARIABLE_DECL',
            name: 'x',
            type: { universe: 'integer', min: '0', max: '100' },
            initialValue: {
                kind: 'INTEGER_LITERAL',
                type: { universe: 'integer', value: '42' },
            },
        }
        const result = lowerStmt(decl)
        expect(result).toBe('int64_t x = 42;')
    })

    it('uses Integer* for unbounded integers', () => {
        const decl: Declaration = {
            kind: 'VARIABLE_DECL',
            name: 'x',
            type: { universe: 'integer' },
            initialValue: {
                kind: 'INTEGER_LITERAL',
                type: { universe: 'integer', value: '42' },
            },
        }
        expect(lowerStmt(decl)).toBe('Integer* x = Integer¸fromInt64(42);')
    })

    it('uses Integer* for ranges beyond 64 bits', () => {
        const decl: Declaration = {
            kind: 'VARIABLE_DECL',
            name: 'x',
            type: { universe: 'integer', min: '0', max: '9223372036854775808' },
            initialValue: {
                kind: 'INTEGER_LITERAL',
                type: {
                    universe: 'integer',
                    value: '9223372036854775808',
                },
            },
        }
        expect(lowerStmt(decl)).toBe(
            'Integer* x = Integer¸fromCString("9223372036854775808");',
        )
    })

    it('lowers variable references correctly', () => {
        const expr: Expression = {
            kind: 'VARIABLE_REF',
            name: 'foo',
            type: { universe: 'integer', max: '42', min: '42' },
        }
        const result = lowerExpr(expr)
        expect(result).toBe('foo')
    })
})
