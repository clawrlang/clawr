import { describe, expect, it } from 'bun:test'
import { newSemanticContext, someCodeSpan } from '../../util'
import { DataDeclaration } from '../../../src/model/data-declaration'
import {
    ExplicitIntegerValueSet,
    ExplicitTruthValueSet,
} from '../../../src/model/explicit-value-set'
import { TypeName } from '../../../src/model/type-name'

describe('DataDeclaration', () => {
    it('outputs the correct CIR', () => {
        const dataDecl = DataDeclaration.create({
            name: TypeName.create({ name: 'MyData' }),
            fields: [
                {
                    name: 'field1',
                    isImmutable: false,
                    valueSet: ExplicitIntegerValueSet.create({
                        span: someCodeSpan,
                    }),
                },
                {
                    name: 'field2',
                    isImmutable: false,
                    valueSet: ExplicitTruthValueSet.create({
                        span: someCodeSpan,
                    }),
                },
            ],
        })
        const context = newSemanticContext()
        dataDecl.emitDeclaration(context)
        expect(context.scope.rootScope.emitted).toEqual([
            {
                kind: 'TYPE_DECL',
                name: 'MyData',
                fields: [
                    {
                        name: 'field1',
                        valueSet: {
                            type: 'integer',
                            min: undefined,
                            max: undefined,
                        },
                    },
                    {
                        name: 'field2',
                        valueSet: {
                            type: 'truthvalue',
                            values: ['false', 'ambiguous', 'true'],
                        },
                    },
                ],
            },
        ])
    })
})
