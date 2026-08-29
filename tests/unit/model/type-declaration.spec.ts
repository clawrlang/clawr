import { describe, expect, it } from 'bun:test'
import { newSemanticContext, someCodeSpan } from '@@/util'
import { DataDeclaration } from '@/model/data-declaration'
import { TypeName } from '@/model/type-name'
import { ISOLATED } from '@/model/isolation-level'
import { IntegerLattice, TruthvalueLattice } from '@/model/lattice'
import { decorateLattice } from '@/model/lattice-declaration'
import { Failable } from '@/model/failable'

describe('DataDeclaration', () => {
    it('outputs the correct CIR', () => {
        const dataDecl = DataDeclaration.create({
            name: TypeName.create({ name: 'MyData' }),
            fields: [
                {
                    name: 'field1',
                    isImmutable: false,
                    isolationLevel: ISOLATED,
                    lattice: decorateLattice(IntegerLattice.unconstrained(), {
                        span: someCodeSpan,
                    }),
                },
                {
                    name: 'field2',
                    isImmutable: false,
                    isolationLevel: ISOLATED,
                    lattice: decorateLattice(
                        TruthvalueLattice.unconstrained(),
                        {
                            span: someCodeSpan,
                        },
                    ),
                },
            ],
        })
        const context = newSemanticContext()
        Failable.do(() => dataDecl.emitDeclaration(context))
        expect(context.scope.rootScope.emitted).toEqual([
            {
                kind: 'RC_TYPE_DECL',
                name: 'MyData',
                fields: [
                    {
                        name: 'field1',
                        lattice: {
                            type: 'integer',
                            min: undefined,
                            max: undefined,
                        },
                    },
                    {
                        name: 'field2',
                        lattice: {
                            type: 'truthvalue',
                            values: ['false', 'ambiguous', 'true'],
                        },
                    },
                ],
            },
        ])
    })
})
