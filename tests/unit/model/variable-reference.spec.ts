import { describe, expect, it } from 'bun:test'
import { VariableReference } from '../../../src/model'

describe('Variable Reference', () => {
    it('generates correct CIR', () => {
        const variableRef = VariableReference.create('myVar')
        expect(variableRef.toCIR()).toEqual({
            kind: 'VARIABLE_REF',
            name: 'myVar',
        })
    })
})
