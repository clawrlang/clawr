import { describe, expect, it } from 'bun:test'
import { VariableReference } from '../../../src/model'
import { newSemanticContext } from '../../util'

describe('Variable Reference', () => {
    it('generates correct CIR', () => {
        const variableRef = VariableReference.create('myVar')
        expect(variableRef.toCIR(newSemanticContext())).toEqual({
            kind: 'VARIABLE_REF',
            name: 'myVar',
        })
    })
})
