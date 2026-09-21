import { DataDeclaration } from '@/model/data-declaration'
import { decorateDomain } from '@/model/domain-declaration'
import { ISOLATED } from '@/model/isolation-level'
import { TypeName } from '@/model/type-name'
import { IntegerRange, TruthvalueSet } from '@/model/value-set'
import { newSemanticContext, someCodeSpan } from '@@/util'
import { describe, expect, it } from 'bun:test'

describe('DataDeclaration', () => {
    it('outputs the correct CIR', () => {
        const dataDecl = DataDeclaration.create({
            name: TypeName.create({ name: 'MyData' }),
            fields: [
                {
                    name: 'field1',
                    isImmutable: false,
                    isolationLevel: ISOLATED,
                    domain: decorateDomain(IntegerRange.unconstrained(), {
                        span: someCodeSpan,
                    }),
                },
                {
                    name: 'field2',
                    isImmutable: false,
                    isolationLevel: ISOLATED,
                    domain: decorateDomain(TruthvalueSet.unconstrained(), {
                        span: someCodeSpan,
                    }),
                },
            ],
        })
        const context = newSemanticContext()
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
