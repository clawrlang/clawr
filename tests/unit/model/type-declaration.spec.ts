import { DataDeclaration } from '@/model/data-declaration'
import { TruthvalueSet } from '@/model/value-set'
import * as util from '@@/util'
import { describe, expect, it } from 'bun:test'

describe('DataDeclaration', () => {
    it('outputs the correct CIR', () => {
        const dataDecl = DataDeclaration.create({
            name: util.simpleTypeName('MyData'),
            fields: [
                { ...util.someFieldDeclConfig, name: 'field1' },
                {
                    ...util.someFieldDeclConfig,
                    name: 'field2',
                    domain: util.spannedDomain(TruthvalueSet.unconstrained()),
                },
            ],
        })
        const context = util.newSemanticContext()
        dataDecl.emitDeclaration(context)
        expect(context.scope.rootScope.emitted).toEqual([
            {
                kind: 'RC_TYPE_DECL',
                name: 'MyData',
                fields: [
                    {
                        name: 'field1',
                        domain: {
                            type: 'integer',
                            min: undefined,
                            max: undefined,
                        },
                    },
                    {
                        name: 'field2',
                        domain: {
                            type: 'truthvalue',
                            values: ['false', 'ambiguous', 'true'],
                        },
                    },
                ],
            },
        ])
    })
})
