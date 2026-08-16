import * as cir from '../../../src/cir'
import { describe, it, expect, test } from 'bun:test'
import {
    FunctionDeclaration,
    Parameter,
} from '../../../src/model/function-declaration'
import { newSemanticContext, someCodeSpan } from '../../util'
import { IntegerLiteral } from '../../../src/model/integer-literal'
import { ReturnStatement } from '../../../src/model/return-statement'
import { DataDeclaration } from '../../../src/model/data-declaration'
import { VariableDeclaration } from '../../../src/model/variable-declaration'
import { DataLiteral } from '../../../src/model/data-literal'
import { VariableReference } from '../../../src/model/variable-reference'
import {
    IntegerLattice,
    RCTypeLattice,
    StringLattice,
} from '../../../src/model/lattice'
import { TypeName } from '../../../src/model/type-name'
import { ISOLATED, SHARED } from '../../../src/model/isolation-level'

describe('FunctionDeclaration', () => {
    it('converts to CIR with function body', () => {
        const funcDecl = FunctionDeclaration.create({
            baseName: 'myFunction',
            parameters: [
                Parameter.create({
                    label: 'param1',
                    isImmutable: true,
                    varName: 'x',
                    valueSet: {
                        isolationLevel: ISOLATED,
                        lattice: StringLattice.create(),
                        span: someCodeSpan,
                    },
                    span: someCodeSpan,
                }),
            ],
            result: undefined,
            implementation: { kind: 'body', statements: [] },
        })

        const context = newSemanticContext()
        funcDecl.emitDeclaration(context)

        const decl = context.scope.rootScope.emitted[0]

        expect(decl).toMatchObject({
            kind: 'FUNCTION_DECL',
            baseName: 'myFunction',
            parameters: [
                {
                    label: 'param1',
                    varName: 'x',
                    valueSet: { type: 'string' },
                },
            ],
            resultValueSet: undefined,
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
        funcDecl.emitDeclaration(context)

        const decl = context.scope.rootScope.emitted[0]

        expect(decl).toMatchObject({
            kind: 'FUNCTION_DECL',
            baseName: 'myFunction',
            parameters: [],
            resultValueSet: { type: 'integer', min: '42', max: '42' },
            body: [
                {
                    kind: 'RETURN',
                    value: { value: '42' },
                },
            ],
        })
    })

    it('converts to CIR with explicit result value-set', () => {
        const funcDecl = FunctionDeclaration.create({
            baseName: 'myFunction',
            parameters: [],
            result: {
                isolationLevel: ISOLATED,
                lattice: IntegerLattice.unconstrained(),
                span: someCodeSpan,
            },
            implementation: {
                kind: 'body',
                statements: [
                    ReturnStatement.create(
                        IntegerLiteral.create({
                            value: 42n,
                            span: someCodeSpan,
                        }),
                    ),
                ],
            },
        })

        const context = newSemanticContext()
        funcDecl.emitDeclaration(context)

        const decl = context.scope.rootScope.emitted[0]

        expect(decl).toMatchObject({
            kind: 'FUNCTION_DECL',
            baseName: 'myFunction',
            parameters: [],
            resultValueSet: { type: 'integer', min: undefined, max: undefined },
            body: [
                {
                    kind: 'RETURN',
                    value: { value: '42' },
                },
            ],
        })
    })

    it('throws if returning SHARED as UNIQUE', () => {
        const context = newSemanticContext()
        context.scope.rootScope.addDataDeclaration(
            TypeName.create({ name: 'MyData' }),
            DataDeclaration.create({
                name: TypeName.create({ name: 'MyData' }),
                fields: [],
            }),
        )
        context.scope.variables.set('myVar', {
            isImmutable: true,
            isolationLevel: SHARED,
            lattice: RCTypeLattice.create({
                type: TypeName.create({ name: 'MyData' }),
            }),
        })
        context.scope.setCurrentValue(
            'myVar',
            RCTypeLattice.create({
                type: TypeName.create({ name: 'MyData' }),
            }),
        )

        const funcDecl = FunctionDeclaration.create({
            baseName: 'myFunction',
            parameters: [],
            result: {
                isolationLevel: ISOLATED,
                lattice: RCTypeLattice.create({
                    type: TypeName.create({ name: 'MyData' }),
                }),
                span: someCodeSpan,
            },
            implementation: {
                kind: 'implicit-return',
                expression: VariableReference.create({
                    name: 'myVar',
                    span: someCodeSpan,
                }),
            },
        })

        expect(() => funcDecl.emitDeclaration(context)).not.toThrow(
            /Cannot return a SHARED variable as UNIQUE/,
        )
    })

    it('throws if returning ISOLATED as SHARED', () => {
        const context = newSemanticContext()
        context.scope.rootScope.addDataDeclaration(
            TypeName.create({ name: 'MyData' }),
            DataDeclaration.create({
                name: TypeName.create({ name: 'MyData' }),
                fields: [],
            }),
        )
        context.scope.variables.set('myVar', {
            isImmutable: true,
            isolationLevel: ISOLATED,
            lattice: RCTypeLattice.create({
                type: TypeName.create({ name: 'MyData' }),
            }),
        })
        context.scope.setCurrentValue(
            'myVar',
            RCTypeLattice.create({
                type: TypeName.create({ name: 'MyData' }),
                fields: {},
            }),
        )

        const funcDecl = FunctionDeclaration.create({
            baseName: 'myFunction',
            parameters: [],
            result: {
                isolationLevel: ISOLATED,
                lattice: RCTypeLattice.create({
                    type: TypeName.create({ name: 'MyData' }),
                }),
                span: someCodeSpan,
            },
            implementation: {
                kind: 'implicit-return',
                expression: VariableReference.create({
                    name: 'myVar',
                    span: someCodeSpan,
                }),
            },
        })

        expect(() => funcDecl.emitDeclaration(context)).not.toThrow(
            /Cannot return an ISOLATED variable as ref/,
        )
    })

    it('throws if returning ISOLATED as SHARED', () => {
        const context = newSemanticContext()
        context.scope.rootScope.addDataDeclaration(
            TypeName.create({ name: 'MyData' }),
            DataDeclaration.create({
                name: TypeName.create({ name: 'MyData' }),
                fields: [],
            }),
        )
        context.scope.variables.set('myVar', {
            isImmutable: true,
            isolationLevel: ISOLATED,
            lattice: RCTypeLattice.create({
                type: TypeName.create({ name: 'MyData' }),
            }),
        })
        context.scope.setCurrentValue(
            'myVar',
            RCTypeLattice.create({
                type: TypeName.create({ name: 'MyData' }),
                fields: {},
            }),
        )

        const funcDecl = FunctionDeclaration.create({
            baseName: 'myFunction',
            parameters: [],
            result: {
                isolationLevel: ISOLATED,
                lattice: RCTypeLattice.create({
                    type: TypeName.create({ name: 'MyData' }),
                }),
                span: someCodeSpan,
            },
            implementation: {
                kind: 'implicit-return',
                expression: VariableReference.create({
                    name: 'myVar',
                    span: someCodeSpan,
                }),
            },
        })

        expect(() => funcDecl.emitDeclaration(context)).not.toThrow(
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
            funcDecl.emitDeclaration(context)

            const decl = context.scope.rootScope.emitted[0]

            expect(decl).toMatchObject({
                kind: 'FUNCTION_DECL',
                baseName: 'myFunction',
                parameters: [],
                resultValueSet: {
                    type: 'integer',
                    min: '42',
                    max: '42',
                },
                body: [
                    {
                        kind: 'RETURN',
                        value: { value: '42' },
                    },
                ],
            })
        })

        it('infers ISOLATED return value-set from ISOLATED variable expression', () => {
            const context = newSemanticContext()
            context.scope.rootScope.addDataDeclaration(
                TypeName.create({ name: 'MyData' }),
                DataDeclaration.create({
                    name: TypeName.create({ name: 'MyData' }),
                    fields: [],
                }),
            )
            context.scope.variables.set('myVar', {
                isImmutable: true,
                isolationLevel: ISOLATED,
                lattice: RCTypeLattice.create({
                    type: TypeName.create({ name: 'MyData' }),
                }),
            })
            context.scope.setCurrentValue(
                'myVar',
                RCTypeLattice.create({
                    type: TypeName.create({ name: 'MyData' }),
                    fields: {},
                }),
            )

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

            funcDecl.emitDeclaration(context)

            const decl = context.scope.rootScope.emitted[0]
            expect(decl).toMatchObject({
                kind: 'FUNCTION_DECL',
                baseName: 'myFunction',
                resultValueSet: {
                    type: 'rc-type',
                    typeName: 'MyData',
                },
            })
        })

        it('infers SHARED return value-set from SHARED variable expression', () => {
            const context = newSemanticContext()
            context.scope.rootScope.addDataDeclaration(
                TypeName.create({ name: 'MyData' }),
                DataDeclaration.create({
                    name: TypeName.create({ name: 'MyData' }),
                    fields: [],
                }),
            )
            context.scope.variables.set('myVar', {
                isImmutable: true,
                isolationLevel: SHARED,
                lattice: RCTypeLattice.create({
                    type: TypeName.create({ name: 'MyData' }),
                }),
            })
            context.scope.setCurrentValue(
                'myVar',
                RCTypeLattice.create({
                    type: TypeName.create({ name: 'MyData' }),
                }),
            )

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

            funcDecl.emitDeclaration(context)

            const decl = context.scope.rootScope.emitted[0]
            expect(decl).toMatchObject({
                kind: 'FUNCTION_DECL',
                baseName: 'myFunction',
                resultValueSet: {
                    type: 'rc-type',
                    typeName: 'MyData',
                },
            })
        })
    })

    it('registers the function declaration in the root scope', () => {
        const funcDecl = FunctionDeclaration.create({
            baseName: 'myFunction',
            parameters: [],
            result: undefined,
            implementation: { kind: 'body', statements: [] },
        })

        const context = newSemanticContext()
        funcDecl.emitDeclaration(context)

        const decl = context.scope.rootScope.functionDeclaration('myFunction()')
        expect(decl).not.toBeNil()
        if (!decl) throw new Error('no function decl!!')
        expect(decl).toBeInstanceOf(FunctionDeclaration)
        expect(decl.baseName).toBe('myFunction')
        expect(decl.parameters).toEqual([])
        expect(decl.result).toBeUndefined()
        expect(decl.implementation).toEqual({ kind: 'body', statements: [] })
    })

    it('registers parameters in the function body scope', () => {
        const decl = FunctionDeclaration.create({
            baseName: 'myFunction',
            parameters: [
                Parameter.create({
                    label: 'param1',
                    isImmutable: true,
                    varName: 'x',
                    valueSet: {
                        isolationLevel: ISOLATED,
                        lattice: StringLattice.create(),
                        span: someCodeSpan,
                    },
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
        decl.emitDeclaration(context)

        expect((context.scope.rootScope.emitted as any)[0].body).toMatchObject([
            {
                kind: 'RETURN',
                value: {
                    kind: 'VARIABLE_REF',
                    name: 'x',
                    valueSet: { type: 'string' },
                },
            },
        ])
    })

    describe('releases rc-type variables before returning from the function', () => {
        test('with no return', () => {
            const context = newSemanticContext()

            context.scope.rootScope.addDataDeclaration(
                TypeName.create({ name: 'MyData' }),
                DataDeclaration.create({
                    name: TypeName.create({ name: 'MyData' }),
                    fields: [
                        {
                            name: 'field1',
                            isImmutable: false,
                            valueSet: {
                                isolationLevel: ISOLATED,
                                lattice: IntegerLattice.unconstrained(),
                                span: someCodeSpan,
                            },
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
                            valueSet: {
                                isolationLevel: ISOLATED,
                                lattice: RCTypeLattice.create({
                                    type: TypeName.create({ name: 'MyData' }),
                                }),
                                span: someCodeSpan,
                            },
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

            funcDecl.emitDeclaration(context)

            const decl = context.scope.rootScope
                .emitted[0] as cir.Declaration & {
                kind: 'FUNCTION_DECL'
            }

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
                TypeName.create({ name: 'MyData' }),
                DataDeclaration.create({
                    name: TypeName.create({ name: 'MyData' }),
                    fields: [
                        {
                            name: 'field1',
                            isImmutable: false,
                            valueSet: {
                                isolationLevel: ISOLATED,
                                lattice: IntegerLattice.unconstrained(),
                                span: someCodeSpan,
                            },
                        },
                    ],
                }),
            )

            const funcDecl = FunctionDeclaration.create({
                baseName: 'myFunction',
                parameters: [],
                result: {
                    isolationLevel: ISOLATED,
                    lattice: IntegerLattice.unconstrained(),
                    span: someCodeSpan,
                },
                implementation: {
                    kind: 'body',
                    statements: [
                        VariableDeclaration.create({
                            isImmutable: true,
                            name: 'myVar',
                            valueSet: {
                                isolationLevel: ISOLATED,
                                lattice: RCTypeLattice.create({
                                    type: TypeName.create({ name: 'MyData' }),
                                }),
                                span: someCodeSpan,
                            },
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
                        ReturnStatement.create(
                            IntegerLiteral.create({
                                value: 42n,
                                span: someCodeSpan,
                            }),
                        ),
                    ],
                },
            })

            funcDecl.emitDeclaration(context)

            const decl = context.scope.rootScope
                .emitted[0] as cir.Declaration & {
                kind: 'FUNCTION_DECL'
            }

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
                TypeName.create({ name: 'MyData' }),
                DataDeclaration.create({
                    name: TypeName.create({ name: 'MyData' }),
                    fields: [],
                }),
            )

            const funcDecl = FunctionDeclaration.create({
                baseName: 'myFunction',
                parameters: [],
                result: {
                    isolationLevel: ISOLATED,
                    lattice: RCTypeLattice.create({
                        type: TypeName.create({ name: 'MyData' }),
                    }),
                    span: someCodeSpan,
                },
                implementation: {
                    kind: 'body',
                    statements: [
                        VariableDeclaration.create({
                            isImmutable: true,
                            name: 'myVar',
                            valueSet: {
                                isolationLevel: ISOLATED,
                                lattice: RCTypeLattice.create({
                                    type: TypeName.create({ name: 'MyData' }),
                                }),
                                span: someCodeSpan,
                            },
                            initialValue: DataLiteral.create({
                                fields: [],
                                span: someCodeSpan,
                            }),
                        }),
                        ReturnStatement.create(
                            VariableReference.create({
                                name: 'myVar',
                                span: someCodeSpan,
                            }),
                        ),
                    ],
                },
            })

            funcDecl.emitDeclaration(context)

            const decl = context.scope.rootScope
                .emitted[0] as CIRFunctionDeclaration

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

type CIRFunctionDeclaration = cir.Declaration & { kind: 'FUNCTION_DECL' }
