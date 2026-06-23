import { describe, expect, it } from 'bun:test'
import { VariableReference } from '../../../src/model'
import { TestErrorReporter } from '../../util'

describe('Variable Reference', () => {
    it('generates correct CIR', () => {
        const variableRef = VariableReference.create('myVar')
        expect(variableRef.toCIR(emptyContext)).toEqual({
            kind: 'VARIABLE_REF',
            name: 'myVar',
        })
    })
})

const emptyContext = {
    variableTypes: new Map(),
    errorReporter: new TestErrorReporter('test.clawr'),
}
