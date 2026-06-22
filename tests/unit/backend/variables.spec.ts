import { describe, expect, it, test } from 'bun:test'
import { Expression } from '../../../src/cir'
import { lowerExpr } from '../../../src/backend'

describe('Lowering Variables', () => {
    it('lowers variable references correctly', () => {
        const expr: Expression = {
            kind: 'VARIABLE_REF',
            name: 'foo',
        }
        const result = lowerExpr(expr)
        expect(result).toBe('foo')
    })
})
