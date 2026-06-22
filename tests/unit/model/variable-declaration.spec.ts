import { describe, expect, it } from 'bun:test'
import { IntegerLiteral, VariableDeclaration } from '../../../src/model'

describe('VariableDeclaration', () => {
    it('converts to CIR VARIABLE_DECL', () => {
        const decl = new VariableDeclaration(
            'const',
            'foo',
            'integer',
            IntegerLiteral.create(1n),
        )
        expect(decl.toCIR()).toEqual({
            kind: 'VARIABLE_DECL',
            name: 'foo',
            type: 'integer',
            initialValue: { kind: 'INTEGER_LITERAL', value: '1' },
        })
    })
})
