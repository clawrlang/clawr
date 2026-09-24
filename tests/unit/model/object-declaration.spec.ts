import { DataLiteral } from '@/model/data-literal'
import { FunctionDeclaration } from '@/model/function-declaration'
import { IntegerLiteral } from '@/model/integer-literal'
import { ISOLATED } from '@/model/isolation-level'
import { ObjectDeclaration } from '@/model/object-declaration'
import { SelfAssignment } from '@/model/self-assignment'
import { IntegerRange } from '@/model/value-set'
import * as util from '@@/util'
import { describe, expect, it } from 'bun:test'

describe('ObjectDeclaration', () => {
    it('converts to CIR', () => {
        const object = ObjectDeclaration.create({
            ...util.someObjectDeclConfig,
            name: util.simpleTypeName('Object'),
            superType: 'Super',
            fields: [
                {
                    name: 'field',
                    isImmutable: true,
                    isolationLevel: 'ISOLATED',
                    domain: util.spannedDomain(IntegerRange.singleton(20n)),
                    defaultValue: util.integerLiteral(20),
                },
            ],
        })

        const context = util.newSemanticContext()
        const result = object.emitDeclaration(context)
        expect(result.isSuccess || result.error.errors).toBeTrue()
        expect(
            context.scope.objectDeclaration(util.simpleTypeName('Object')),
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
            ...util.someObjectDeclConfig,
            name: util.simpleTypeName('Object'),
            superType: 'Super',
            readonly: [
                FunctionDeclaration.create({
                    baseName: 'read',
                    parameters: [
                        {
                            ...util.someParameterDeclConfig,
                            label: 'label',
                            varName: 'var',
                        },
                    ],
                    implementation: {
                        kind: 'implicit-return',
                        expression: util.integerLiteral(42),
                    },
                    result: {
                        isolationLevel: ISOLATED,
                        domain: util.spannedDomain(IntegerRange.singleton(42n)),
                    },
                }),
            ],
            mutating: [
                FunctionDeclaration.create({
                    ...util.someFunctionDeclConfig,
                    baseName: 'mutate',
                    parameters: [
                        {
                            ...util.someParameterDeclConfig,
                            label: 'label',
                            varName: 'var',
                        },
                    ],
                }),
            ],
            fields: [
                {
                    name: 'field',
                    isImmutable: true,
                    isolationLevel: 'ISOLATED',
                    domain: util.spannedDomain(IntegerRange.singleton(20n)),
                    defaultValue: util.integerLiteral(20),
                },
            ],
        })

        const context = util.newSemanticContext()
        const result = object.emitDeclaration(context)
        expect(result.isSuccess || result.error.errors).toBeTrue()
        expect(
            context.scope.objectDeclaration(util.simpleTypeName('Object')),
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
            ...util.someObjectDeclConfig,
            name: util.simpleTypeName('Object'),
            superType: 'Super',
            initializers: [
                FunctionDeclaration.create({
                    ...util.someFunctionDeclConfig,
                    baseName: 'implicit',
                    implementation: {
                        kind: 'implicit-return',
                        expression: DataLiteral.create({
                            fields: [
                                {
                                    name: 'field',
                                    value: util.integerLiteral(1),
                                },
                            ],
                            span: util.someCodeSpan,
                        }),
                    },
                }),
                FunctionDeclaration.create({
                    baseName: 'selfAssign',
                    parameters: [
                        {
                            ...util.someParameterDeclConfig,
                            label: 'label',
                            varName: 'var',
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
                                            value: util.integerLiteral(1),
                                        },
                                    ],
                                    span: util.someCodeSpan,
                                }),
                                span: util.someCodeSpan,
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
                    domain: util.spannedDomain(IntegerRange.singleton(20n)),
                    defaultValue: IntegerLiteral.create({
                        value: 20n,
                        span: util.someCodeSpan,
                    }),
                },
            ],
        })

        const context = util.newSemanticContext()
        const result = object.emitDeclaration(context)
        expect(result.isSuccess || result.error.errors).toBeTrue()
        expect(
            context.scope.objectDeclaration(util.simpleTypeName('Object')),
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
