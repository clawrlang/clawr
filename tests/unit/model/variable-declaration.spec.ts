import { describe, expect, it } from 'bun:test'
import { IntegerLiteral } from '../../../src/model/integer-literal'
import { VariableDeclaration } from '../../../src/model/variable-declaration'
import { newSemanticContext } from '../../util'

describe('VariableDeclaration', () => {
    it('converts to CIR VARIABLE_DECL', () => {
        const decl = VariableDeclaration.create({
            semantics: 'const',
            name: 'foo',
            type: 'integer',
            initialValue: IntegerLiteral.create(1n),
        })
        expect(decl.toCIR(newSemanticContext())).toEqual({
            kind: 'VARIABLE_DECL',
            name: 'foo',
            type: 'integer',
            initialValue: { kind: 'INTEGER_LITERAL', value: '1' },
        })
    })

    it('registers itself in the context', () => {
        const decl = VariableDeclaration.create({
            semantics: 'const',
            name: 'x',
            type: 'integer',
            initialValue: IntegerLiteral.create(42n),
        })
        const context = newSemanticContext()
        decl.toCIR(context)
        expect(context.scope.variables.get('x')).toEqual({
            kind: 'const',
            type: 'integer',
        })
    })
})
