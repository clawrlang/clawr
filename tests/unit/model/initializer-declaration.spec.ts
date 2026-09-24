import { DataDeclaration } from '@/model/data-declaration'
import { DataLiteral } from '@/model/data-literal'
import { decorateDomain } from '@/model/domain-declaration'
import { FunctionDeclaration } from '@/model/function-declaration'
import { IntegerLiteral } from '@/model/integer-literal'
import { ISOLATED, SHARED } from '@/model/isolation-level'
import { ObjectDeclaration } from '@/model/object-declaration'
import { Parameter } from '@/model/parameter'
import { ReturnStatement } from '@/model/return-statement'
import { TypeName } from '@/model/type-name'
import { IntegerRange, RCTypeSet, StringSet } from '@/model/value-set'
import { VariableDeclaration } from '@/model/variable-declaration'
import { VariableReference } from '@/model/variable-reference'
import { newSemanticContext, someCodeSpan } from '@@/util'
import { describe, expect, it, test } from 'bun:test'

describe('FunctionDeclaration (initializer)', () => {
    it('converts to CIR with function body', () => {
        const funcDecl = FunctionDeclaration.create({
            baseName: 'makeNew',
            parameters: [
                Parameter.create({
                    label: 'param1',
                    isImmutable: true,
                    varName: 'x',
                    isolationLevel: ISOLATED,
                    domain: decorateDomain(StringSet.create(), {
                        span: someCodeSpan,
                    }),
                    span: someCodeSpan,
                }),
            ],
            result: undefined,
            implementation: { kind: 'body', statements: [] },
        })

        const context = newSemanticContext()
        const result = funcDecl.emitInitializer(context)
        expect(result.isSuccess || result.error.errors).toBeTrue()

        const decl = result.isSuccess && result.value
        expect(decl).toMatchObject({
            kind: 'FUNCTION_DECL',
            baseName: 'makeNew',
            labels: ['param1'],
            parameters: [
                {
                    name: 'x',
                    domain: { type: 'string' },
                },
            ],
            domain: undefined,
            body: [],
        })
    })

    it('converts to CIR with implicit self-assignment  ', () => {
        const funcDecl = FunctionDeclaration.create({
            baseName: 'makeNew',
            parameters: [],
            result: undefined,
            implementation: {
                kind: 'implicit-return',
                expression: DataLiteral.create({
                    fields: [
                        {
                            name: 'field',
                            value: IntegerLiteral.create({
                                value: 42n,
                                span: someCodeSpan,
                            }),
                        },
                    ],
                    span: someCodeSpan,
                }),
            },
        })

        const context = newSemanticContext()
        context.scope.addObjectDeclaration(
            ObjectDeclaration.create({
                fields: [
                    {
                        name: 'field',
                        isImmutable: false,
                        isolationLevel: ISOLATED,
                        domain: decorateDomain(IntegerRange.unconstrained(), {
                            span: someCodeSpan,
                        }),
                    },
                ],
                initializers: [],
                kind: 'object',
                mutating: [],
                name: TypeName.create({ name: 'Object' }),
                readonly: [],
                span: someCodeSpan,
            }),
        )
        context.scope.addSelfVariable(TypeName.create({ name: 'Object' }))

        const result = funcDecl.emitInitializer(context)
        expect(result.isSuccess || result.error.errors).toBeTrue()

        const decl = result.isSuccess && result.value
        expect(decl).toMatchObject({
            kind: 'FUNCTION_DECL',
            baseName: 'makeNew',
            parameters: [],
            domain: undefined,
            body: [
                {
                    kind: 'SELF_ASSIGN',
                    value: {
                        kind: 'DATA',
                        fields: [
                            { value: { value: { max: '42', min: '42' } } },
                        ],
                    },
                },
            ],
        })
    })

    it('converts to CIR with explicit result value-set', () => {
        const funcDecl = FunctionDeclaration.create({
            baseName: 'makeNew',
            parameters: [],
            result: {
                domain: decorateDomain(IntegerRange.unconstrained(), {
                    span: someCodeSpan,
                }),
                isolationLevel: ISOLATED,
            },
            implementation: {
                kind: 'body',
                statements: [
                    ReturnStatement.create({
                        value: IntegerLiteral.create({
                            value: 42n,
                            span: someCodeSpan,
                        }),
                        span: someCodeSpan,
                    }),
                ],
            },
        })

        const context = newSemanticContext()
        const result = funcDecl.emitInitializer(context)
        expect(result.isSuccess || result.error.errors).toBeTrue()

        const decl = result.isSuccess && result.value
        expect(decl).toMatchObject({
            kind: 'FUNCTION_DECL',
            baseName: 'makeNew',
            parameters: [],
            domain: undefined,
            body: [
                {
                    kind: 'RETURN',
                    value: { value: { max: '42', min: '42' } },
                },
            ],
        })
    })

    it('throws if returning SHARED as UNIQUE', () => {
        const context = newSemanticContext()
        context.scope.rootScope.addDataDeclaration(
            DataDeclaration.create({
                name: TypeName.create({ name: 'MyData' }),
                fields: [],
            }),
        )
        context.scope.addVariableDeclaration('myVar', {
            isImmutable: true,
            isolationLevel: SHARED,
            domain: RCTypeSet.create({
                type: TypeName.create({ name: 'MyData' }),
            }),
        })

        const funcDecl = FunctionDeclaration.create({
            baseName: 'makeNew',
            parameters: [],
            result: {
                domain: decorateDomain(
                    RCTypeSet.create({
                        type: TypeName.create({ name: 'MyData' }),
                    }),
                    { span: someCodeSpan },
                ),
                isolationLevel: ISOLATED,
            },
            implementation: {
                kind: 'implicit-return',
                expression: VariableReference.create({
                    name: 'myVar',
                    span: someCodeSpan,
                }),
            },
        })

        expect(() => funcDecl.emitInitializer(context)).not.toThrow(
            /Cannot return a SHARED variable as UNIQUE/,
        )
    })

    it('throws if returning ISOLATED as SHARED', () => {
        const context = newSemanticContext()
        context.scope.rootScope.addDataDeclaration(
            DataDeclaration.create({
                name: TypeName.create({ name: 'MyData' }),
                fields: [],
            }),
        )
        context.scope.addVariableDeclaration('myVar', {
            isImmutable: true,
            isolationLevel: ISOLATED,
            domain: RCTypeSet.create({
                type: TypeName.create({ name: 'MyData' }),
            }),
        })

        const funcDecl = FunctionDeclaration.create({
            baseName: 'makeNew',
            parameters: [],
            result: {
                domain: decorateDomain(
                    RCTypeSet.create({
                        type: TypeName.create({ name: 'MyData' }),
                    }),
                    { span: someCodeSpan },
                ),
                isolationLevel: ISOLATED,
            },
            implementation: {
                kind: 'implicit-return',
                expression: VariableReference.create({
                    name: 'myVar',
                    span: someCodeSpan,
                }),
            },
        })

        expect(() => funcDecl.emitInitializer(context)).not.toThrow(
            /Cannot return an ISOLATED variable as ref/,
        )
    })

    it('throws if returning ISOLATED as SHARED', () => {
        const context = newSemanticContext()
        context.scope.rootScope.addDataDeclaration(
            DataDeclaration.create({
                name: TypeName.create({ name: 'MyData' }),
                fields: [],
            }),
        )
        context.scope.addVariableDeclaration('myVar', {
            isImmutable: true,
            isolationLevel: ISOLATED,
            domain: RCTypeSet.create({
                type: TypeName.create({ name: 'MyData' }),
            }),
        })

        const funcDecl = FunctionDeclaration.create({
            baseName: 'makeNew',
            parameters: [],
            result: {
                domain: decorateDomain(
                    RCTypeSet.create({
                        type: TypeName.create({ name: 'MyData' }),
                    }),
                    { span: someCodeSpan },
                ),
                isolationLevel: ISOLATED,
            },
            implementation: {
                kind: 'implicit-return',
                expression: VariableReference.create({
                    name: 'myVar',
                    span: someCodeSpan,
                }),
            },
        })

        expect(() => funcDecl.emitInitializer(context)).not.toThrow(
            /Cannot return an ISOLATED variable as ref/,
        )
    })

    it('infers self-assignment from implicit-return expression', () => {
        const funcDecl = FunctionDeclaration.create({
            baseName: 'makeNew',
            parameters: [],
            result: undefined,
            implementation: {
                kind: 'implicit-return',
                expression: DataLiteral.create({
                    fields: [],
                    span: someCodeSpan,
                }),
            },
        })

        const context = newSemanticContext()
        context.scope.addObjectDeclaration(
            ObjectDeclaration.create({
                kind: 'object',
                name: TypeName.create({ name: 'Object' }),
                fields: [],
                initializers: [],
                mutating: [],
                readonly: [],
                span: someCodeSpan,
            }),
        )
        context.scope.addSelfVariable(TypeName.create({ name: 'Object' }))

        const result = funcDecl.emitInitializer(context)
        expect(result.isSuccess || result.error.errors).toBeTrue()

        const decl = result.isSuccess && result.value
        expect(decl).toMatchObject({
            kind: 'FUNCTION_DECL',
            baseName: 'makeNew',
            parameters: [],
            domain: undefined,
            body: [
                {
                    kind: 'SELF_ASSIGN',
                    value: { kind: 'DATA' },
                },
            ],
        })
    })

    it('registers parameters in the function body scope', () => {
        const decl = FunctionDeclaration.create({
            baseName: 'makeNew',
            parameters: [
                Parameter.create({
                    label: 'param1',
                    isImmutable: true,
                    varName: 'x',
                    isolationLevel: ISOLATED,
                    domain: decorateDomain(StringSet.create(), {
                        span: someCodeSpan,
                    }),
                    span: someCodeSpan,
                }),
            ],
            result: undefined,
            implementation: {
                kind: 'implicit-return',
                expression: DataLiteral.create({
                    fields: [
                        {
                            name: 'field',
                            value: VariableReference.create({
                                name: 'x',
                                span: someCodeSpan,
                            }),
                        },
                    ],
                    span: someCodeSpan,
                }),
            },
        })

        const context = newSemanticContext()
        context.scope.addObjectDeclaration(
            ObjectDeclaration.create({
                kind: 'object',
                name: TypeName.create({ name: 'Object' }),
                readonly: [],
                mutating: [],
                initializers: [],
                fields: [
                    {
                        name: 'field',
                        isImmutable: false,
                        isolationLevel: ISOLATED,
                        domain: decorateDomain(IntegerRange.unconstrained(), {
                            span: someCodeSpan,
                        }),
                    },
                ],
                span: someCodeSpan,
            }),
        )
        context.scope.addSelfVariable(TypeName.create({ name: 'Object' }))

        const result = decl.emitInitializer(context)
        expect(result.isSuccess || result.error.errors).toBeTrue()

        expect(result.isSuccess && result.value.body).toMatchObject([
            {
                kind: 'SELF_ASSIGN',
                value: {
                    kind: 'DATA',
                    fields: [
                        {
                            name: 'field',
                            value: {
                                kind: 'VARIABLE_REF',
                                name: 'x',
                                value: {
                                    type: 'string',
                                },
                            },
                        },
                    ],
                    value: {
                        type: 'rc-type',
                        name: 'Object',
                        namespace: undefined,
                    },
                },
            },
        ])
    })

    describe('releases rc-type variables before returning from the function', () => {
        test('with no return', () => {
            const context = newSemanticContext()

            context.scope.rootScope.addDataDeclaration(
                DataDeclaration.create({
                    name: TypeName.create({ name: 'MyData' }),
                    fields: [
                        {
                            name: 'field1',
                            isImmutable: false,
                            isolationLevel: ISOLATED,
                            domain: decorateDomain(
                                IntegerRange.unconstrained(),
                                { span: someCodeSpan },
                            ),
                        },
                    ],
                }),
            )

            const funcDecl = FunctionDeclaration.create({
                baseName: 'makeNew',
                parameters: [],
                result: undefined,
                implementation: {
                    kind: 'body',
                    statements: [
                        VariableDeclaration.create({
                            isImmutable: true,
                            name: 'myVar',
                            isolationLevel: ISOLATED,
                            domain: decorateDomain(
                                RCTypeSet.create({
                                    type: TypeName.create({ name: 'MyData' }),
                                }),
                                { span: someCodeSpan },
                            ),
                            initialValue: DataLiteral.create({
                                fields: [
                                    {
                                        name: 'field1',
                                        value: IntegerLiteral.create({
                                            value: 42n,
                                            span: someCodeSpan,
                                        }),
                                    },
                                ],
                                span: someCodeSpan,
                            }),
                            nameSpan: someCodeSpan,
                            span: someCodeSpan,
                        }),
                    ],
                },
            })

            const result = funcDecl.emitInitializer(context)
            expect(result.isSuccess || result.error.errors).toBeTrue()

            const decl = result.isSuccess ? result.value : undefined!
            expect(decl.body[decl.body.length - 1]).toMatchObject({
                kind: 'RELEASE',
                object: {
                    kind: 'VARIABLE_REF',
                    name: 'myVar',
                },
            })
        })

        test('ending with return', () => {
            const context = newSemanticContext()

            context.scope.rootScope.addDataDeclaration(
                DataDeclaration.create({
                    name: TypeName.create({ name: 'MyData' }),
                    fields: [
                        {
                            name: 'field1',
                            isImmutable: false,
                            isolationLevel: ISOLATED,
                            domain: decorateDomain(
                                IntegerRange.unconstrained(),
                                { span: someCodeSpan },
                            ),
                        },
                    ],
                }),
            )

            const funcDecl = FunctionDeclaration.create({
                baseName: 'makeNew',
                parameters: [],
                result: {
                    domain: decorateDomain(IntegerRange.unconstrained(), {
                        span: someCodeSpan,
                    }),
                    isolationLevel: ISOLATED,
                },
                implementation: {
                    kind: 'body',
                    statements: [
                        VariableDeclaration.create({
                            isImmutable: true,
                            name: 'myVar',
                            isolationLevel: ISOLATED,
                            domain: decorateDomain(
                                RCTypeSet.create({
                                    type: TypeName.create({ name: 'MyData' }),
                                }),
                                { span: someCodeSpan },
                            ),
                            initialValue: DataLiteral.create({
                                fields: [
                                    {
                                        name: 'field1',
                                        value: IntegerLiteral.create({
                                            value: 42n,
                                            span: someCodeSpan,
                                        }),
                                    },
                                ],
                                span: someCodeSpan,
                            }),
                            nameSpan: someCodeSpan,
                            span: someCodeSpan,
                        }),
                        ReturnStatement.create({
                            value: IntegerLiteral.create({
                                value: 42n,
                                span: someCodeSpan,
                            }),
                            span: someCodeSpan,
                        }),
                    ],
                },
            })

            const result = funcDecl.emitInitializer(context)
            expect(result.isSuccess || result.error.errors).toBeTrue()

            const decl = result.isSuccess ? result.value : undefined!
            expect(decl.body[decl.body.length - 2]).toMatchObject({
                kind: 'RELEASE',
                object: {
                    kind: 'VARIABLE_REF',
                    name: 'myVar',
                },
            })
        })

        test('returns UNIQUE return values with a ref-count of 1', () => {
            const context = newSemanticContext()

            context.scope.rootScope.addDataDeclaration(
                DataDeclaration.create({
                    name: TypeName.create({ name: 'MyData' }),
                    fields: [],
                }),
            )

            const funcDecl = FunctionDeclaration.create({
                baseName: 'makeNew',
                parameters: [],
                result: {
                    domain: decorateDomain(
                        RCTypeSet.create({
                            type: TypeName.create({ name: 'MyData' }),
                        }),
                        { span: someCodeSpan },
                    ),
                    isolationLevel: ISOLATED,
                },
                implementation: {
                    kind: 'body',
                    statements: [
                        VariableDeclaration.create({
                            isImmutable: true,
                            name: 'myVar',
                            isolationLevel: ISOLATED,
                            domain: decorateDomain(
                                RCTypeSet.create({
                                    type: TypeName.create({ name: 'MyData' }),
                                }),
                                { span: someCodeSpan },
                            ),
                            initialValue: DataLiteral.create({
                                fields: [],
                                span: someCodeSpan,
                            }),
                            nameSpan: someCodeSpan,
                            span: someCodeSpan,
                        }),
                        ReturnStatement.create({
                            value: VariableReference.create({
                                name: 'myVar',
                                span: someCodeSpan,
                            }),
                            span: someCodeSpan,
                        }),
                    ],
                },
            })

            const result = funcDecl.emitInitializer(context)
            expect(result.isSuccess || result.error.errors).toBeTrue()

            const decl = result.isSuccess ? result.value : undefined!
            expect(decl.body).toMatchObject([
                { kind: 'VARIABLE_DECL' },
                {
                    kind: 'ENSURE_UNIQUE',
                    object: {
                        kind: 'VARIABLE_REF',
                        name: 'myVar',
                    },
                },
                {
                    kind: 'VARIABLE_DECL',
                    initialValue: {
                        kind: 'RETAIN',
                        object: { kind: 'VARIABLE_REF', name: 'myVar' },
                    },
                },
                { kind: 'RELEASE' },
                {
                    kind: 'RETURN',
                    value: {
                        kind: 'VARIABLE_REF',
                        name: expect.stringMatching(/^__tempˇ\d+$/),
                    },
                },
            ])
        })
    })
})
