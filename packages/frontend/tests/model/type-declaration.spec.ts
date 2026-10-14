import { DataDeclaration } from '@/model/data-declaration'
import { TruthvalueSet } from '@/model/value-set'
import * as util from '@@/util'
import { describe, expect, it } from 'bun:test'

describe('DataDeclaration', () => {
    it('outputs the correct CIR', () => {
        const dataDecl = DataDeclaration.create({
            name: util.simpleTypeName('MyData'),
            properties: [
                { ...util.somePropertyDeclConfig, name: 'property1' },
                {
                    ...util.somePropertyDeclConfig,
                    name: 'property2',
                    type: util.spannedTypeConstraint(
                        TruthvalueSet.unconstrained(),
                    ),
                },
            ],
        })
        const context = util.newSemanticContext()
        dataDecl.emitDeclaration(context)
        expect(context.scope.rootScope.emitted).toEqual([
            {
                kind: 'RC_TYPE_DECL',
                name: 'MyData',
                properties: [
                    {
                        name: 'property1',
                        type: {
                            universe: 'integer',
                            min: undefined,
                            max: undefined,
                        },
                    },
                    {
                        name: 'property2',
                        type: { universe: 'truthvalue' },
                    },
                ],
            },
        ])
    })
})
