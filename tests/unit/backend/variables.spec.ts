import { describe, expect, it } from 'bun:test'
import { Declaration, Expression } from '../../../src/cir'
import { lowerExpr, lowerStmt } from '../../../src/backend'

describe('Lowering Variables', () => {
    it('lowers variable declarations correctly', () => {
        const decl: Declaration = {
            kind: 'VARIABLE_DECL',
            name: 'x',
            lattice: { type: 'integer' },
            initialValue: {
                kind: 'INTEGER_LITERAL',
                value: { type: 'integer', max: '42', min: '42' },
            },
        }
        const result = lowerStmt(decl)
        expect(result).toBe('int64_t x = 42;')
    })

    it('lowers variable references correctly', () => {
        const expr: Expression = {
            kind: 'VARIABLE_REF',
            name: 'foo',
            value: { type: 'integer', max: '42', min: '42' },
        }
        const result = lowerExpr(expr)
        expect(result).toBe('foo')
    })
})
