import * as cir from '@/cir'
import { FunctionDeclaration } from '@/model/function-declaration'
import { IntegerLiteral } from '@/model/integer-literal'
import { ISOLATED } from '@/model/isolation-level'
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

    it('adds both readonly and mutating methods', () => {
        const object = ObjectDeclaration.create({
            kind: 'object',
            name: TypeName.create({ name: 'Object' }),
            superType: 'Super',
            readonly: [
                FunctionDeclaration.create({
                    baseName: 'read',
                    parameters: [
                        {
                            label: 'label',
                            isImmutable: true,
                            isolationLevel: ISOLATED,
                            lattice: decorateLattice(
                                IntegerLattice.unconstrained(),
                                { span: someCodeSpan },
                            ),
                            varName: 'var',
                            span: someCodeSpan,
                        },
                    ],
                    implementation: {
                        kind: 'implicit-return',
                        expression: IntegerLiteral.create({
                            value: 42n,
                            span: someCodeSpan,
                        }),
                    },
                    result: {
                        isolationLevel: ISOLATED,
                        lattice: decorateLattice(
                            IntegerLattice.singleton(42n),
                            { span: someCodeSpan },
                        ),
                    },
                }),
            ],
            mutating: [
                FunctionDeclaration.create({
                    baseName: 'mutate',
                    parameters: [
                        {
                            label: 'label',
                            isImmutable: true,
                            isolationLevel: ISOLATED,
                            lattice: decorateLattice(
                                IntegerLattice.unconstrained(),
                                { span: someCodeSpan },
                            ),
                            varName: 'var',
                            span: someCodeSpan,
                        },
                    ],
                    implementation: {
                        kind: 'body',
                        statements: [],
                    },
                    result: undefined,
                }),
            ],
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
                methods: [
                    {
                        kind: 'FUNCTION_DECL',
                        baseName: 'read',
                        labels: ['label'],
                        parameters: [{ name: 'var' }],
                        body: [{ kind: 'RETURN' }],
                        lattice: {},
                    },
                    {
                        kind: 'FUNCTION_DECL',
                        baseName: 'mutate',
                        labels: ['label'],
                        parameters: [{ name: 'var' }],
                        body: [],
                        lattice: undefined,
                    },
                ],
            }, //satisfies cir.Declaration,
        ])
    })
})
