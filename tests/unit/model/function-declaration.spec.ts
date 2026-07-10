import * as cir from '../../../src/cir'
import { describe, it, expect, test } from 'bun:test'
import {
    FunctionDeclaration,
    Parameter,
} from '../../../src/model/function-declaration'
import {
    IntegerValueSet,
    RCTypeValueSet,
    StringValueSet,
} from '../../../src/model/value-set'
import { newSemanticContext, someCodeSpan } from '../../util'
import { IntegerLiteral } from '../../../src/model/integer-literal'
import { ReturnStatement } from '../../../src/model/return-statement'
import { DataDeclaration } from '../../../src/model/data-declaration'
import { VariableDeclaration } from '../../../src/model/variable-declaration'
import { DataLiteral } from '../../../src/model/data-literal'
import { basename } from 'node:path'

describe('FunctionDeclaration', () => {
    it('converts to CIR with function body', () => {
        const funcDecl = FunctionDeclaration.create({
            baseName: 'myFunction',
            parameters: [
                Parameter.create({
                    label: 'param1',
                    varName: 'x',
                    valueSet: StringValueSet.create({ span: someCodeSpan }),
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
                    name: 'x',
                    valueSet: { type: 'string' },
                },
            ],
            returnValueSet: undefined,
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
            returnValueSet: { type: 'integer', min: '42', max: '42' },
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
            result: IntegerValueSet.create({
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
            returnValueSet: { type: 'integer', min: undefined, max: undefined },
            body: [
                {
                    kind: 'RETURN',
                    value: { value: '42' },
                },
            ],
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
                            valueSet: IntegerValueSet.create({
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
                            valueSet: RCTypeValueSet.create({
                                typeName: 'MyData',
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
                            valueSet: IntegerValueSet.create({
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
                result: IntegerValueSet.create({ span: someCodeSpan }),
                implementation: {
                    kind: 'body',
                    statements: [
                        VariableDeclaration.create({
                            semantics: 'const',
                            name: 'myVar',
                            valueSet: RCTypeValueSet.create({
                                typeName: 'MyData',
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
