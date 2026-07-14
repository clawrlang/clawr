import * as cir from '../../../src/cir'
import { describe, it, expect, test } from 'bun:test'
import {
    FunctionDeclaration,
    Parameter,
} from '../../../src/model/function-declaration'
import {
    ExplicitIntegerValueSet,
    ExplicitRCTypeValueSet,
    ExplicitStringValueSet,
    ExplicitUniqueValueSet,
} from '../../../src/model/explicit-value-set'
import { newSemanticContext, someCodeSpan } from '../../util'
import { IntegerLiteral } from '../../../src/model/integer-literal'
import { ReturnStatement } from '../../../src/model/return-statement'
import { DataDeclaration } from '../../../src/model/data-declaration'
import { VariableDeclaration } from '../../../src/model/variable-declaration'
import { DataLiteral } from '../../../src/model/data-literal'
import { VariableReference } from '../../../src/model/variable-reference'
import { CowTypeLattice, RefTypeLattice } from '../../../src/model/lattice'

describe('FunctionDeclaration', () => {
    it('converts to CIR with function body', () => {
        const funcDecl = FunctionDeclaration.create({
            baseName: 'myFunction',
            parameters: [
                Parameter.create({
                    label: 'param1',
                    varName: 'x',
                    valueSet: ExplicitStringValueSet.create({
                        span: someCodeSpan,
                    }),
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
            result: ExplicitIntegerValueSet.create({
                span: someCodeSpan,
            }),
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

    it('throws if returning REF as UNIQUE', () => {
        const context = newSemanticContext()
        context.scope.rootScope.declarations.set(
            'MyData',
            DataDeclaration.create({
                name: 'MyData',
                fields: [],
            }),
        )
        context.scope.variables.set('myVar', {
            semantics: 'const',
            valueSet: {
                type: 'rc-type',
                typeName: 'MyData',
                semantics: 'REF',
            },
        })
        context.scope.setCurrentValue(
            'myVar',
            RefTypeLattice.create({
                typeName: 'MyData',
            }),
        )

        const funcDecl = FunctionDeclaration.create({
            baseName: 'myFunction',
            parameters: [],
            result: ExplicitUniqueValueSet.create({
                typeName: 'MyData',
                span: someCodeSpan,
            }),
            implementation: {
                kind: 'implicit-return',
                expression: VariableReference.create({
                    name: 'myVar',
                    span: someCodeSpan,
                }),
            },
        })

        expect(() => funcDecl.emitDeclaration(context)).toThrow(
            /Cannot return a REF variable as UNIQUE/,
        )
    })

    it('throws if returning COW as REF', () => {
        const context = newSemanticContext()
        context.scope.rootScope.declarations.set(
            'MyData',
            DataDeclaration.create({
                name: 'MyData',
                fields: [],
            }),
        )
        context.scope.variables.set('myVar', {
            semantics: 'const',
            valueSet: {
                type: 'rc-type',
                typeName: 'MyData',
                semantics: 'COW',
            },
        })
        context.scope.setCurrentValue(
            'myVar',
            CowTypeLattice.create({
                typeName: 'MyData',
                fields: {},
            }),
        )

        const funcDecl = FunctionDeclaration.create({
            baseName: 'myFunction',
            parameters: [],
            result: ExplicitRCTypeValueSet.create({
                typeName: 'MyData',
                semantics: 'ref',
                span: someCodeSpan,
            }),
            implementation: {
                kind: 'implicit-return',
                expression: VariableReference.create({
                    name: 'myVar',
                    span: someCodeSpan,
                }),
            },
        })

        expect(() => funcDecl.emitDeclaration(context)).toThrow(
            /Cannot return a COW variable as ref/,
        )
    })

    it('throws if returning COW as REF', () => {
        const context = newSemanticContext()
        context.scope.rootScope.declarations.set(
            'MyData',
            DataDeclaration.create({
                name: 'MyData',
                fields: [],
            }),
        )
        context.scope.variables.set('myVar', {
            semantics: 'const',
            valueSet: {
                type: 'rc-type',
                typeName: 'MyData',
                semantics: 'COW',
            },
        })
        context.scope.setCurrentValue(
            'myVar',
            CowTypeLattice.create({
                typeName: 'MyData',
                fields: {},
            }),
        )

        const funcDecl = FunctionDeclaration.create({
            baseName: 'myFunction',
            parameters: [],
            result: ExplicitRCTypeValueSet.create({
                typeName: 'MyData',
                semantics: 'ref',
                span: someCodeSpan,
            }),
            implementation: {
                kind: 'implicit-return',
                expression: VariableReference.create({
                    name: 'myVar',
                    span: someCodeSpan,
                }),
            },
        })

        expect(() => funcDecl.emitDeclaration(context)).toThrow(
            /Cannot return a COW variable as ref/,
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

        it('infers COW return value-set from COW variable expression', () => {
            const context = newSemanticContext()
            context.scope.rootScope.declarations.set(
                'MyData',
                DataDeclaration.create({
                    name: 'MyData',
                    fields: [],
                }),
            )
            context.scope.variables.set('myVar', {
                semantics: 'const',
                valueSet: {
                    type: 'rc-type',
                    typeName: 'MyData',
                    semantics: 'COW',
                },
            })
            context.scope.setCurrentValue(
                'myVar',
                CowTypeLattice.create({
                    typeName: 'MyData',
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
                    semantics: 'COW',
                },
            })
        })

        it('infers REF return value-set from REF variable expression', () => {
            const context = newSemanticContext()
            context.scope.rootScope.declarations.set(
                'MyData',
                DataDeclaration.create({
                    name: 'MyData',
                    fields: [],
                }),
            )
            context.scope.variables.set('myVar', {
                semantics: 'const',
                valueSet: {
                    type: 'rc-type',
                    typeName: 'MyData',
                    semantics: 'REF',
                },
            })
            context.scope.setCurrentValue(
                'myVar',
                RefTypeLattice.create({
                    typeName: 'MyData',
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
                    semantics: 'REF',
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

        expect(context.scope.rootScope.declarations.has('myFunction()')).toBe(
            true,
        )
        const decl = context.scope.rootScope.declarations.get(
            'myFunction()',
        ) as FunctionDeclaration
        expect(decl).toBeInstanceOf(FunctionDeclaration)
        expect(decl.baseName).toBe('myFunction')
        expect(decl.parameters).toEqual([])
        expect(decl.result).toBeUndefined()
        expect(decl.implementation).toEqual({ kind: 'body', statements: [] })
    })

    describe('releases rc-type variables before returning from the function', () => {
        test('with no return', () => {
            const context = newSemanticContext()

            context.scope.rootScope.declarations.set(
                'MyData',
                DataDeclaration.create({
                    name: 'MyData',
                    fields: [
                        {
                            name: 'field1',
                            valueSet: ExplicitIntegerValueSet.create({
                                span: someCodeSpan,
                            }),
                            semantics: 'mut',
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
                            semantics: 'const',
                            name: 'myVar',
                            valueSet: ExplicitRCTypeValueSet.create({
                                typeName: 'MyData',
                                semantics: 'mut',
                                span: someCodeSpan,
                            }),
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
                    valueSet: { type: 'rc-type', typeName: 'MyData' },
                },
            })
        })

        test('ending with return', () => {
            const context = newSemanticContext()

            context.scope.rootScope.declarations.set(
                'MyData',
                DataDeclaration.create({
                    name: 'MyData',
                    fields: [
                        {
                            name: 'field1',
                            valueSet: ExplicitIntegerValueSet.create({
                                span: someCodeSpan,
                            }),
                            semantics: 'mut',
                        },
                    ],
                }),
            )

            const funcDecl = FunctionDeclaration.create({
                baseName: 'myFunction',
                parameters: [],
                result: ExplicitIntegerValueSet.create({ span: someCodeSpan }),
                implementation: {
                    kind: 'body',
                    statements: [
                        VariableDeclaration.create({
                            semantics: 'const',
                            name: 'myVar',
                            valueSet: ExplicitRCTypeValueSet.create({
                                typeName: 'MyData',
                                semantics: 'const',
                                span: someCodeSpan,
                            }),
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
                    valueSet: { type: 'rc-type', typeName: 'MyData' },
                },
            })
        })
    })
})
