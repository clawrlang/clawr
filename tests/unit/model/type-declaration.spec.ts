import { describe, expect, it } from 'bun:test'
import { newSemanticContext, someCodeSpan } from '../../util'
import { DataDeclaration } from '../../../src/model/data-declaration'
import { TypeName } from '../../../src/model/type-name'
import { ISOLATED } from '../../../src/model/isolation-level'
import { IntegerLattice, Truthlattice } from '../../../src/model/lattice'
import { decorateLattice } from '../../../src/model/lattice-declaration'

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
                    lattice: decorateLattice(Truthlattice.unconstrained(), {
                        span: someCodeSpan,
                    }),
                },
            ],
        })
        const context = newSemanticContext()
        dataDecl._emitDeclaration(context)
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
