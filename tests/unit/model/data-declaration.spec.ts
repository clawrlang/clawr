import { describe, expect, it } from 'bun:test'
import { newSemanticContext } from '../../util'
import { DataDeclaration } from '../../../src/model/data-declaration'

describe('DataDeclaration', () => {
    it('outputs the correct CIR', () => {
        const dataDecl = DataDeclaration.create({
            name: 'MyData',
            fields: [
                { name: 'field1', type: 'integer', semantics: 'mut' },
                { name: 'field2', type: 'truthvalue', semantics: 'mut' },
            ],
        })
        const context = newSemanticContext()
        dataDecl.emitDeclaration(context)
        expect(context.scope.emitted.declarations).toEqual([
            {
                kind: 'DATA_DECL',
                name: 'MyData',
                fields: [
                    { name: 'field1', valueSet: { type: 'integer' } },
                    { name: 'field2', valueSet: { type: 'truthvalue' } },
                ],
            },
        ])
    })
})
