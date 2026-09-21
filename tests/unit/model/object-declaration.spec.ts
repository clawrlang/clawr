import { DataLiteral } from '@/model/data-literal'
import { decorateDomain } from '@/model/domain-declaration'
import { FunctionDeclaration } from '@/model/function-declaration'
import { IntegerLiteral } from '@/model/integer-literal'
import { ISOLATED } from '@/model/isolation-level'
import { ObjectDeclaration } from '@/model/object-declaration'
import { SelfAssignment } from '@/model/self-assignment'
import { TypeName } from '@/model/type-name'
import { IntegerRange } from '@/model/value-set'
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
                    domain: decorateDomain(IntegerRange.singleton(20n), {
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

        object.emitDeclaration(context)

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
                        domain: {
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
                            domain: decorateDomain(
                                IntegerRange.unconstrained(),
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
                        domain: decorateDomain(IntegerRange.singleton(42n), {
                            span: someCodeSpan,
                        }),
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
                            domain: decorateDomain(
                                IntegerRange.unconstrained(),
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
                    domain: decorateDomain(IntegerRange.singleton(20n), {
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
        object.emitDeclaration(context)

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
                        domain: {},
                    },
                    {
                        kind: 'FUNCTION_DECL',
                        baseName: 'mutate',
                        labels: ['label'],
                        parameters: [{ name: 'var' }],
                        body: [],
                        domain: undefined,
                    },
                ],
            }, //satisfies cir.Declaration,
        ])
    })

    it('adds initializers', () => {
        const object = ObjectDeclaration.create({
            kind: 'object',
            name: TypeName.create({ name: 'Object' }),
            superType: 'Super',
            readonly: [],
            mutating: [],
            initializers: [
                FunctionDeclaration.create({
                    baseName: 'implicit',
                    parameters: [],
                    implementation: {
                        kind: 'implicit-return',
                        expression: DataLiteral.create({
                            fields: [
                                {
                                    name: 'field',
                                    value: IntegerLiteral.create({
                                        value: 1n,
                                        span: someCodeSpan,
                                    }),
                                },
                            ],
                            span: someCodeSpan,
                        }),
                    },
                    result: undefined,
                }),
                FunctionDeclaration.create({
                    baseName: 'selfAssign',
                    parameters: [
                        {
                            label: 'label',
                            isImmutable: true,
                            isolationLevel: ISOLATED,
                            domain: decorateDomain(
                                IntegerRange.unconstrained(),
                                { span: someCodeSpan },
                            ),
                            varName: 'var',
                            span: someCodeSpan,
                        },
                    ],
                    implementation: {
                        kind: 'body',
                        statements: [
                            SelfAssignment.create({
                                value: DataLiteral.create({
                                    fields: [
                                        {
                                            name: 'field',
                                            value: IntegerLiteral.create({
                                                value: 1n,
                                                span: someCodeSpan,
                                            }),
                                        },
                                    ],
                                    span: someCodeSpan,
                                }),
                                span: someCodeSpan,
                            }),
                        ],
                    },
                    result: undefined,
                }),
            ],
            fields: [
                {
                    name: 'field',
                    isImmutable: true,
                    isolationLevel: 'ISOLATED',
                    domain: decorateDomain(IntegerRange.singleton(20n), {
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
        const result = object.emitDeclaration(context)

        expect(result.isSuccess || result.error.errors).toBeTrue()
        expect(
            context.scope.objectDeclaration(
                TypeName.create({ name: 'Object' }),
            ),
        ).not.toBeNil()

        expect(context.scope.rootScope.emitted).toMatchObject([
            {
                kind: 'RC_TYPE_DECL',
                name: 'Object',
                initializers: [
                    {
                        kind: 'FUNCTION_DECL',
                        baseName: 'implicit',
                        labels: [],
                        parameters: [],
                        body: [
                            {
                                kind: 'SELF_ASSIGN',
                                value: {},
                            },
                        ],
                        domain: undefined,
                    },
                    {
                        kind: 'FUNCTION_DECL',
                        baseName: 'selfAssign',
                        labels: ['label'],
                        parameters: [{ name: 'var' }],
                        body: [
                            {
                                kind: 'SELF_ASSIGN',
                                value: {},
                            },
                        ],
                        domain: undefined,
                    },
                ],
            },
        ])
    })
})
