import { IntegerLiteral } from '@/model/integer-literal'
import { IntegerLattice } from '@/model/lattice'
import { decorateLattice } from '@/model/lattice-declaration'
import { ObjectDeclaration } from '@/model/object-declaration'
import { TypeName } from '@/model/type-name'
import { Failable } from '@/tools/failable'
import { newSemanticContext, someCodeSpan } from '@@/util'
import { describe, expect, it } from 'bun:test'

describe('ObjectDeclaration', () => {
    it('converts to CIR', () => {
        const object = ObjectDeclaration.create({
            kind: 'object',
            name: TypeName.create({ name: 'Object' }),
            superType: 'Super',
            readonly: [],
            mutating: [],
            initializers: [],
            fields: [
                {
                    name: 'field',
                    isImmutable: true,
                    isolationLevel: 'ISOLATED',
                    lattice: decorateLattice(IntegerLattice.singleton(20n), {
                        span: someCodeSpan,
                    }),
                    defaultValue: IntegerLiteral.create({
                        value: 20n,
                        span: someCodeSpan,
                    }),
                },
            ],
            span: someCodeSpan,
        })

        const context = newSemanticContext()

        Failable.do(() => object.emitDeclaration(context))

        expect(
            context.scope.objectDeclaration(
                TypeName.create({ name: 'Object' }),
            ),
        ).not.toBeNil()

        expect(context.scope.rootScope.emitted).toMatchObject([
            {
                kind: 'RC_TYPE_DECL',
                name: 'Object',
                fields: [
                    {
                        name: 'field',
                        lattice: {
                            max: '20',
                            min: '20',
                            type: 'integer',
                        },
                    },
                ],
            },
        ])
    })
})
