import { describe, expect, it } from 'bun:test'
import { VariableReference } from '../../../src/model/variable-reference'
import { newSemanticContext } from '../../util'

describe('Variable Reference', () => {
    it('generates correct CIR', () => {
        const variableRef = VariableReference.create('myVar')
        expect(variableRef.toCIR(newSemanticContext())).toEqual({
            kind: 'VARIABLE_REF',
            name: 'myVar',
        })
    })

    it('infers its type from the context', () => {
        const context = newSemanticContext()
        context.scope.variableTypes.set('myVar', 'integer')

        const variableRef = VariableReference.create('myVar')
        expect(variableRef.type(context)).toBe('integer')
    })
})
