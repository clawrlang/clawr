import { DataDeclaration } from '@/model/data-declaration'
import { DataLiteral } from '@/model/data-literal'
import { FunctionDeclaration } from '@/model/function-declaration'
import { ISOLATED, SHARED } from '@/model/isolation-level'
import { Parameter } from '@/model/parameter'
import { ReturnStatement } from '@/model/return-statement'
import { IntegerRange, RCTypeSet, StringSet } from '@/model/value-set'
import { VariableDeclaration } from '@/model/variable-declaration'
import * as util from '@@/util'
import { describe, expect, it, test } from 'bun:test'

describe('FunctionDeclaration (method)', () => {
    it('converts to CIR with function body', () => {
        const funcDecl = FunctionDeclaration.create({
            ...util.someFunctionDeclConfig,
            baseName: 'myFunction',
            parameters: [
                Parameter.create({
                    ...util.someParameterDeclConfig,
                    label: 'param1',
                    varName: 'x',
                    domain: util.spannedDomain(StringSet.create()),
                }),
            ],
        })

        const context = util.newSemanticContext()
        const result = funcDecl.emitMethod(context)
        expect(result.isSuccess || result.error.errors).toBeTrue()
        expect(result.isSuccess && result.value).toMatchObject({
            kind: 'FUNCTION_DECL',
            baseName: 'myFunction',
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

    it('converts to CIR with implicit return', () => {
        const funcDecl = FunctionDeclaration.create({
            ...util.someFunctionDeclConfig,
            baseName: 'myFunction',
            implementation: {
                kind: 'implicit-return',
                expression: util.integerLiteral(42),
            },
        })

        const context = util.newSemanticContext()
        const result = funcDecl.emitMethod(context)
        expect(result.isSuccess || result.error.errors).toBeTrue()
        expect(result.isSuccess && result.value).toMatchObject({
            kind: 'FUNCTION_DECL',
            baseName: 'myFunction',
            parameters: [],
            domain: { type: 'integer', min: '42', max: '42' },
            body: [
                {
                    kind: 'RETURN',
                    value: { value: { max: '42', min: '42' } },
                },
            ],
        })
    })

    it('converts to CIR with explicit result value-set', () => {
        const funcDecl = FunctionDeclaration.create({
            baseName: 'myFunction',
            parameters: [],
            result: {
                domain: util.spannedDomain(IntegerRange.unconstrained()),
                isolationLevel: ISOLATED,
            },
            implementation: {
                kind: 'body',
                statements: [
                    ReturnStatement.create({
                        value: util.integerLiteral(42),
                        span: util.someCodeSpan,
                    }),
                ],
            },
        })

        const context = util.newSemanticContext()
        const result = funcDecl.emitMethod(context)
        expect(result.isSuccess || result.error.errors).toBeTrue()
        expect(result.isSuccess && result.value).toMatchObject({
            kind: 'FUNCTION_DECL',
            baseName: 'myFunction',
            parameters: [],
            domain: { type: 'integer', min: undefined, max: undefined },
            body: [
                {
                    kind: 'RETURN',
                    value: { value: { max: '42', min: '42' } },
                },
            ],
        })
    })

    it('throws if returning SHARED as UNIQUE', () => {
        const context = util.newSemanticContext()
        context.scope.rootScope.addDataDeclaration(
            DataDeclaration.create({
                name: util.simpleTypeName('MyData'),
                fields: [],
            }),
        )
        context.scope.addVariableDeclaration('myVar', {
            isImmutable: true,
            isolationLevel: SHARED,
            domain: RCTypeSet.create({
                type: util.simpleTypeName('MyData'),
            }),
        })

        const funcDecl = FunctionDeclaration.create({
            baseName: 'myFunction',
            parameters: [],
            result: {
                domain: util.spannedDomain(
                    RCTypeSet.create({
                        type: util.simpleTypeName('MyData'),
                    }),
                ),
                isolationLevel: ISOLATED,
            },
            implementation: {
                kind: 'implicit-return',
                expression: util.variableRef('myVar'),
            },
        })

        expect(() => funcDecl.emitMethod(context)).not.toThrow(
            /Cannot return a SHARED variable as UNIQUE/,
        )
    })

    it('throws if returning ISOLATED as SHARED', () => {
        const context = util.newSemanticContext()
        context.scope.rootScope.addDataDeclaration(
            DataDeclaration.create({
                name: util.simpleTypeName('MyData'),
                fields: [],
            }),
        )
        context.scope.addVariableDeclaration('myVar', {
            isImmutable: true,
            isolationLevel: ISOLATED,
            domain: RCTypeSet.create({
                type: util.simpleTypeName('MyData'),
            }),
        })

        const funcDecl = FunctionDeclaration.create({
            baseName: 'myFunction',
            parameters: [],
            result: {
                domain: util.spannedDomain(
                    RCTypeSet.create({
                        type: util.simpleTypeName('MyData'),
                    }),
                ),
                isolationLevel: ISOLATED,
            },
            implementation: {
                kind: 'implicit-return',
                expression: util.variableRef('myVar'),
            },
        })

        expect(() => funcDecl.emitMethod(context)).not.toThrow(
            /Cannot return an ISOLATED variable as ref/,
        )
    })

    it('throws if returning ISOLATED as SHARED', () => {
        const context = util.newSemanticContext()
        context.scope.rootScope.addDataDeclaration(
            DataDeclaration.create({
                name: util.simpleTypeName('MyData'),
                fields: [],
            }),
        )
        context.scope.addVariableDeclaration('myVar', {
            isImmutable: true,
            isolationLevel: ISOLATED,
            domain: RCTypeSet.create({
                type: util.simpleTypeName('MyData'),
            }),
        })

        const funcDecl = FunctionDeclaration.create({
            baseName: 'myFunction',
            parameters: [],
            result: {
                domain: util.spannedDomain(
                    RCTypeSet.create({
                        type: util.simpleTypeName('MyData'),
                    }),
                ),
                isolationLevel: ISOLATED,
            },
            implementation: {
                kind: 'implicit-return',
                expression: util.variableRef('myVar'),
            },
        })

        expect(() => funcDecl.emitMethod(context)).not.toThrow(
            /Cannot return an ISOLATED variable as ref/,
        )
    })

    describe('infers return value-set from implicit-return expression', () => {
        it('infers integer return value-set', () => {
            const funcDecl = FunctionDeclaration.create({
                ...util.someFunctionDeclConfig,
                baseName: 'myFunction',
                implementation: {
                    kind: 'implicit-return',
                    expression: util.integerLiteral(42),
                },
            })

            const context = util.newSemanticContext()
            const result = funcDecl.emitMethod(context)
            expect(result.isSuccess || result.error.errors).toBeTrue()
            expect(result.isSuccess && result.value).toMatchObject({
                kind: 'FUNCTION_DECL',
                baseName: 'myFunction',
                parameters: [],
                domain: {
                    type: 'integer',
                    min: '42',
                    max: '42',
                },
                body: [
                    {
                        kind: 'RETURN',
                        value: { value: { max: '42', min: '42' } },
                    },
                ],
            })
        })

        it('infers ISOLATED return value-set from ISOLATED variable expression', () => {
            const context = util.newSemanticContext()
            context.scope.rootScope.addDataDeclaration(
                DataDeclaration.create({
                    name: util.simpleTypeName('MyData'),
                    fields: [],
                }),
            )
            context.scope.addVariableDeclaration('myVar', {
                isImmutable: true,
                isolationLevel: ISOLATED,
                domain: RCTypeSet.create({
                    type: util.simpleTypeName('MyData'),
                }),
            })

            const funcDecl = FunctionDeclaration.create({
                ...util.someFunctionDeclConfig,
                baseName: 'myFunction',
                implementation: {
                    kind: 'implicit-return',
                    expression: util.variableRef('myVar'),
                },
            })

            const result = funcDecl.emitMethod(context)
            expect(result.isSuccess || result.error.errors).toBeTrue()
            expect(result.isSuccess && result.value).toMatchObject({
                kind: 'FUNCTION_DECL',
                baseName: 'myFunction',
                domain: {
                    type: 'rc-type',
                    name: 'MyData',
                },
            })
        })

        it('infers SHARED return value-set from SHARED variable expression', () => {
            const context = util.newSemanticContext()
            context.scope.rootScope.addDataDeclaration(
                DataDeclaration.create({
                    name: util.simpleTypeName('MyData'),
                    fields: [],
                }),
            )
            context.scope.addVariableDeclaration('myVar', {
                isImmutable: true,
                isolationLevel: SHARED,
                domain: RCTypeSet.create({
                    type: util.simpleTypeName('MyData'),
                }),
            })

            const funcDecl = FunctionDeclaration.create({
                ...util.someFunctionDeclConfig,
                baseName: 'myFunction',
                implementation: {
                    kind: 'implicit-return',
                    expression: util.variableRef('myVar'),
                },
            })
            const result = funcDecl.emitMethod(context)
            expect(result.isSuccess || result.error.errors).toBeTrue()
            expect(result.isSuccess && result.value).toMatchObject({
                kind: 'FUNCTION_DECL',
                baseName: 'myFunction',
                domain: {
                    type: 'rc-type',
                    name: 'MyData',
                },
            })
        })
    })

    it('registers parameters in the function body scope', () => {
        const decl = FunctionDeclaration.create({
            baseName: 'myFunction',
            parameters: [
                Parameter.create({
                    ...util.someParameterDeclConfig,
                    label: 'param1',
                    varName: 'x',
                    domain: util.spannedDomain(StringSet.create()),
                }),
            ],
            result: undefined,
            implementation: {
                kind: 'implicit-return',
                expression: util.variableRef('x'),
            },
        })

        const context = util.newSemanticContext()
        const result = decl.emitMethod(context)
        expect(result.isSuccess && result.value).toMatchObject({
            body: [
                {
                    kind: 'RETURN',
                    value: {
                        kind: 'VARIABLE_REF',
                        name: 'x',
                    },
                },
            ],
        })
    })

    describe('releases rc-type variables before returning from the function', () => {
        test('with no return', () => {
            const context = util.newSemanticContext()
            context.scope.rootScope.addDataDeclaration(
                DataDeclaration.create({
                    name: util.simpleTypeName('MyData'),
                    fields: [{ ...util.someFieldDeclConfig, name: 'field1' }],
                }),
            )

            const funcDecl = FunctionDeclaration.create({
                ...util.someFunctionDeclConfig,
                baseName: 'myFunction',
                implementation: {
                    kind: 'body',
                    statements: [
                        VariableDeclaration.create({
                            ...util.someVariableDeclConfig,
                            isImmutable: true,
                            name: 'myVar',
                            domain: util.spannedDomain(
                                RCTypeSet.create({
                                    type: util.simpleTypeName('MyData'),
                                }),
                            ),
                            initialValue: DataLiteral.create({
                                fields: [
                                    {
                                        name: 'field1',
                                        value: util.integerLiteral(42),
                                    },
                                ],
                                span: util.someCodeSpan,
                            }),
                        }),
                    ],
                },
            })

            const result = funcDecl.emitMethod(context)
            const decl = result.isSuccess ? result.value : undefined!
            expect(result.isSuccess || result.error.errors).toBeTrue()
            expect(decl.body[decl.body.length - 1]).toMatchObject({
                kind: 'RELEASE',
                object: {
                    kind: 'VARIABLE_REF',
                    name: 'myVar',
                },
            })
        })

        test('ending with return', () => {
            const context = util.newSemanticContext()
            context.scope.rootScope.addDataDeclaration(
                DataDeclaration.create({
                    name: util.simpleTypeName('MyData'),
                    fields: [{ ...util.someFieldDeclConfig, name: 'field1' }],
                }),
            )

            const funcDecl = FunctionDeclaration.create({
                baseName: 'myFunction',
                parameters: [],
                result: {
                    domain: util.spannedDomain(IntegerRange.unconstrained()),
                    isolationLevel: ISOLATED,
                },
                implementation: {
                    kind: 'body',
                    statements: [
                        VariableDeclaration.create({
                            ...util.someVariableDeclConfig,
                            isImmutable: true,
                            name: 'myVar',
                            domain: util.spannedDomain(
                                RCTypeSet.create({
                                    type: util.simpleTypeName('MyData'),
                                }),
                            ),
                            initialValue: DataLiteral.create({
                                fields: [
                                    {
                                        name: 'field1',
                                        value: util.integerLiteral(42),
                                    },
                                ],
                                span: util.someCodeSpan,
                            }),
                        }),
                        ReturnStatement.create({
                            value: util.integerLiteral(42),
                            span: util.someCodeSpan,
                        }),
                    ],
                },
            })
            const result = funcDecl.emitMethod(context)
            const decl = result.isSuccess ? result.value : undefined!
            expect(result.isSuccess || result.error.errors).toBeTrue()
            expect(decl.body[decl.body.length - 2]).toMatchObject({
                kind: 'RELEASE',
                object: {
                    kind: 'VARIABLE_REF',
                    name: 'myVar',
                },
            })
        })

        test('returns UNIQUE return values with a ref-count of 1', () => {
            const context = util.newSemanticContext()
            context.scope.rootScope.addDataDeclaration(
                DataDeclaration.create({
                    name: util.simpleTypeName('MyData'),
                    fields: [],
                }),
            )

            const funcDecl = FunctionDeclaration.create({
                ...util.someFunctionDeclConfig,
                baseName: 'myFunction',
                result: {
                    domain: util.spannedDomain(
                        RCTypeSet.create({
                            type: util.simpleTypeName('MyData'),
                        }),
                    ),
                    isolationLevel: ISOLATED,
                },
                implementation: {
                    kind: 'body',
                    statements: [
                        VariableDeclaration.create({
                            ...util.someVariableDeclConfig,
                            isImmutable: true,
                            name: 'myVar',
                            domain: util.spannedDomain(
                                RCTypeSet.create({
                                    type: util.simpleTypeName('MyData'),
                                }),
                            ),
                            initialValue: DataLiteral.create({
                                fields: [],
                                span: util.someCodeSpan,
                            }),
                        }),
                        ReturnStatement.create({
                            value: util.variableRef('myVar'),
                            span: util.someCodeSpan,
                        }),
                    ],
                },
            })

            const result = funcDecl.emitMethod(context)
            const decl = result.isSuccess ? result.value : undefined!
            expect(result.isSuccess || result.error.errors).toBeTrue()
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
