import { describe, expect, it } from 'bun:test'
import { newSemanticContext } from '../../util'
import { DataDeclaration } from '../../../src/model/data-declaration'

describe('DataDeclaration', () => {
    it('outputs the correct CIR', () => {
        const dataDecl = DataDeclaration.create({
            name: 'MyData',
            fields: [
                { name: 'field1', type: 'integer' },
                { name: 'field2', type: 'truthvalue' },
            ],
        })
        const context = newSemanticContext()
        const cir = dataDecl.toCIR(context)
        expect(cir).toEqual({
            kind: 'DATA_DECL',
            name: 'MyData',
            fields: [
                { name: 'field1', type: 'integer' },
                { name: 'field2', type: 'truthvalue' },
            ],
        })
    })
})
