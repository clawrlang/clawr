import { describe, expect, it } from 'bun:test'
import { newSemanticContext, someCodeSpan } from '../../util'
import { DataDeclaration } from '../../../src/model/data-declaration'
import {
    ExplicitIntegerValueSet,
    ExplicitTruthValueSet,
} from '../../../src/model/explicit-value-set'

describe('DataDeclaration', () => {
    it('outputs the correct CIR', () => {
        const dataDecl = DataDeclaration.create({
            name: 'MyData',
            fields: [
                {
                    name: 'field1',
                    valueSet: ExplicitIntegerValueSet.create({
                        span: someCodeSpan,
                    }),
                    semantics: 'mut',
                },
                {
                    name: 'field2',
                    valueSet: ExplicitTruthValueSet.create({
                        span: someCodeSpan,
                    }),
                    semantics: 'mut',
                },
            ],
        })
        const context = newSemanticContext()
        dataDecl.emitDeclaration(context)
        expect(context.scope.rootScope.emitted).toEqual([
            {
                kind: 'DATA_DECL',
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
