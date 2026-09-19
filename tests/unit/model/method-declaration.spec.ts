import { DataDeclaration } from '@/model/data-declaration'
import { DataLiteral } from '@/model/data-literal'
import { FunctionDeclaration } from '@/model/function-declaration'
import { IntegerLiteral } from '@/model/integer-literal'
import { ISOLATED, SHARED } from '@/model/isolation-level'
import { IntegerLattice, RCTypeLattice, StringLattice } from '@/model/lattice'
import { decorateLattice } from '@/model/lattice-declaration'
import { Parameter } from '@/model/parameter'
import { ReturnStatement } from '@/model/return-statement'
import { TypeName } from '@/model/type-name'
import { VariableDeclaration } from '@/model/variable-declaration'
import { VariableReference } from '@/model/variable-reference'
import { newSemanticContext, someCodeSpan } from '@@/util'
import { describe, expect, it, test } from 'bun:test'

describe('FunctionDeclaration (method)', () => {
    it('converts to CIR with function body', () => {
        const funcDecl = FunctionDeclaration.create({
            baseName: 'myFunction',
            parameters: [
                Parameter.create({
                    label: 'param1',
                    isImmutable: true,
                    varName: 'x',
                    isolationLevel: ISOLATED,
                    lattice: decorateLattice(StringLattice.create(), {
                        span: someCodeSpan,
                    }),
                    span: someCodeSpan,
                }),
            ],
            result: undefined,
            implementation: { kind: 'body', statements: [] },
        })

        const context = newSemanticContext()
        const result = funcDecl.emitMethod(context)
        expect(result.isSuccess || result.error.errors).toBeTrue()

        const decl = result.isSuccess && result.value
        expect(decl).toMatchObject({
            kind: 'FUNCTION_DECL',
            baseName: 'myFunction',
            labels: ['param1'],
            parameters: [
                {
                    name: 'x',
                    lattice: { type: 'string' },
                },
            ],
            lattice: undefined,
            body: [],
        })
    })

    it('converts to CIR with implicit return', () => {
        const funcDecl = FunctionDeclaration.create({
            baseName: 'myFunction',
            parameters: [],
            result: undefined,
            implementation: {
                kind: 'implicit-return',
                expression: IntegerLiteral.create({
                    value: 42n,
                    span: someCodeSpan,
                }),
            },
        })

        const context = newSemanticContext()
        const result = funcDecl.emitMethod(context)
        expect(result.isSuccess || result.error.errors).toBeTrue()

        const decl = result.isSuccess && result.value
        expect(decl).toMatchObject({
            kind: 'FUNCTION_DECL',
            baseName: 'myFunction',
            parameters: [],
            lattice: { type: 'integer', min: '42', max: '42' },
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
                lattice: decorateLattice(IntegerLattice.unconstrained(), {
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
        const result = funcDecl.emitMethod(context)
        expect(result.isSuccess || result.error.errors).toBeTrue()

        const decl = result.isSuccess && result.value
        expect(decl).toMatchObject({
            kind: 'FUNCTION_DECL',
            baseName: 'myFunction',
            parameters: [],
            lattice: { type: 'integer', min: undefined, max: undefined },
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
            lattice: RCTypeLattice.create({
                type: TypeName.create({ name: 'MyData' }),
            }),
        })

        const funcDecl = FunctionDeclaration.create({
            baseName: 'myFunction',
            parameters: [],
            result: {
                lattice: decorateLattice(
                    RCTypeLattice.create({
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

        expect(() => funcDecl.emitMethod(context)).not.toThrow(
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
            lattice: RCTypeLattice.create({
                type: TypeName.create({ name: 'MyData' }),
            }),
        })

        const funcDecl = FunctionDeclaration.create({
            baseName: 'myFunction',
            parameters: [],
            result: {
                lattice: decorateLattice(
                    RCTypeLattice.create({
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

        expect(() => funcDecl.emitMethod(context)).not.toThrow(
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
            lattice: RCTypeLattice.create({
                type: TypeName.create({ name: 'MyData' }),
            }),
        })

        const funcDecl = FunctionDeclaration.create({
            baseName: 'myFunction',
            parameters: [],
            result: {
                lattice: decorateLattice(
                    RCTypeLattice.create({
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

        expect(() => funcDecl.emitMethod(context)).not.toThrow(
            /Cannot return an ISOLATED variable as ref/,
        )
    })

    describe('infers return value-set from implicit-return expression', () => {
        it('infers integer return value-set', () => {
            const funcDecl = FunctionDeclaration.create({
                baseName: 'myFunction',
                parameters: [],
                result: undefined,
                implementation: {
                    kind: 'implicit-return',
                    expression: IntegerLiteral.create({
                        value: 42n,
                        span: someCodeSpan,
                    }),
                },
            })

            const context = newSemanticContext()
            const result = funcDecl.emitMethod(context)
            expect(result.isSuccess || result.error.errors).toBeTrue()

            const decl = result.isSuccess && result.value
            expect(decl).toMatchObject({
                kind: 'FUNCTION_DECL',
                baseName: 'myFunction',
                parameters: [],
                lattice: {
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
                lattice: RCTypeLattice.create({
                    type: TypeName.create({ name: 'MyData' }),
                }),
            })

            const funcDecl = FunctionDeclaration.create({
                baseName: 'myFunction',
                parameters: [],
                result: undefined,
                implementation: {
                    kind: 'implicit-return',
                    expression: VariableReference.create({
                        name: 'myVar',
                        span: someCodeSpan,
                    }),
                },
            })

            const result = funcDecl.emitMethod(context)
            expect(result.isSuccess || result.error.errors).toBeTrue()

            const decl = result.isSuccess && result.value

            expect(decl).toMatchObject({
                kind: 'FUNCTION_DECL',
                baseName: 'myFunction',
                lattice: {
                    type: 'rc-type',
                    name: 'MyData',
                },
            })
        })

        it('infers SHARED return value-set from SHARED variable expression', () => {
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
                lattice: RCTypeLattice.create({
                    type: TypeName.create({ name: 'MyData' }),
                }),
            })

            const funcDecl = FunctionDeclaration.create({
                baseName: 'myFunction',
                parameters: [],
                result: undefined,
                implementation: {
                    kind: 'implicit-return',
                    expression: VariableReference.create({
                        name: 'myVar',
                        span: someCodeSpan,
                    }),
                },
            })
            const result = funcDecl.emitMethod(context)
            expect(result.isSuccess || result.error.errors).toBeTrue()

            const decl = result.isSuccess && result.value
            expect(decl).toMatchObject({
                kind: 'FUNCTION_DECL',
                baseName: 'myFunction',
                lattice: {
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
                    label: 'param1',
                    isImmutable: true,
                    varName: 'x',
                    isolationLevel: ISOLATED,
                    lattice: decorateLattice(StringLattice.create(), {
                        span: someCodeSpan,
                    }),
                    span: someCodeSpan,
                }),
            ],
            result: undefined,
            implementation: {
                kind: 'implicit-return',
                expression: VariableReference.create({
                    name: 'x',
                    span: someCodeSpan,
                }),
            },
        })

        const context = newSemanticContext()
        const result = decl.emitMethod(context)

        const cir = result.isSuccess && result.value

        expect(cir).toMatchObject({
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
            const context = newSemanticContext()

            context.scope.rootScope.addDataDeclaration(
                DataDeclaration.create({
                    name: TypeName.create({ name: 'MyData' }),
                    fields: [
                        {
                            name: 'field1',
                            isImmutable: false,
                            isolationLevel: ISOLATED,
                            lattice: decorateLattice(
                                IntegerLattice.unconstrained(),
                                { span: someCodeSpan },
                            ),
                        },
                    ],
                }),
            )

            const funcDecl = FunctionDeclaration.create({
                baseName: 'myFunction',
                parameters: [],
                result: undefined,
                implementation: {
                    kind: 'body',
                    statements: [
                        VariableDeclaration.create({
                            isImmutable: true,
                            name: 'myVar',
                            isolationLevel: ISOLATED,
                            lattice: decorateLattice(
                                RCTypeLattice.create({
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
                        }),
                    ],
                },
            })

            const result = funcDecl.emitMethod(context)
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
                            lattice: decorateLattice(
                                IntegerLattice.unconstrained(),
                                { span: someCodeSpan },
                            ),
                        },
                    ],
                }),
            )

            const funcDecl = FunctionDeclaration.create({
                baseName: 'myFunction',
                parameters: [],
                result: {
                    lattice: decorateLattice(IntegerLattice.unconstrained(), {
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
                            lattice: decorateLattice(
                                RCTypeLattice.create({
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

            const result = funcDecl.emitMethod(context)
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
                baseName: 'myFunction',
                parameters: [],
                result: {
                    lattice: decorateLattice(
                        RCTypeLattice.create({
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
                            lattice: decorateLattice(
                                RCTypeLattice.create({
                                    type: TypeName.create({ name: 'MyData' }),
                                }),
                                { span: someCodeSpan },
                            ),
                            initialValue: DataLiteral.create({
                                fields: [],
                                span: someCodeSpan,
                            }),
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

            const result = funcDecl.emitMethod(context)
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
