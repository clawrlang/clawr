import { DataLiteral } from '@/model/data-literal'
import { FunctionCall } from '@/model/function-call'
import { FunctionDeclaration } from '@/model/function-declaration'
import { ISOLATED, SHARED } from '@/model/isolation-level'
import { ObjectDeclaration } from '@/model/object-declaration'
import { Parameter } from '@/model/parameter'
import { RCTypeSet } from '@/model/value-set'
import * as util from '@@/util'
import { describe, expect, it, test } from 'bun:test'

describe('FunctionCall', () => {
    it('converts to CIR', () => {
        const context = util.newSemanticContext()
        context.scope.rootScope.addFunctionDeclaration(
            FunctionDeclaration.create({
                ...util.someFunctionDeclConfig,
                baseName: 'foo',
                implementation: {
                    kind: 'implicit-return',
                    expression: util.integerLiteral(42),
                },
            }),
        )

        const query = FunctionCall.create({
            baseName: 'foo',
            arguments: [],
            span: util.someCodeSpan,
        })
        const result = query.toCIRExpression(context)
        expect(result.isSuccess && result.value).toMatchObject({
            kind: 'CALL',
            name: {
                baseName: 'foo',
                labels: [],
            },
            arguments: [],
        })
    })

    it('includes argument labels in signature', () => {
        const context = util.newSemanticContext()
        context.scope.rootScope.addFunctionDeclaration(
            FunctionDeclaration.create({
                baseName: 'foo',
                parameters: [
                    Parameter.create({
                        ...util.someParameterDeclConfig,
                        label: 'x',
                        varName: 'x',
                    }),
                ],
                result: undefined,
                implementation: {
                    kind: 'implicit-return',
                    expression: util.integerLiteral(42),
                },
            }),
        )

        const query = FunctionCall.create({
            baseName: 'foo',
            arguments: [{ label: 'x', value: util.integerLiteral(42) }],
            span: util.someCodeSpan,
        })
        const result = query.toCIRExpression(context)
        expect(result.isSuccess && result.value).toMatchObject({
            kind: 'CALL',
            name: {
                baseName: 'foo',
                labels: ['x'],
            },
            arguments: [
                {
                    kind: 'INTEGER_LITERAL',
                    value: { max: '42', min: '42' },
                },
            ],
        })
    })

    describe('converts UNIQUE isolation-level to ISOLATED in CIR', () => {
        test('for custom function', () => {
            const context = util.newSemanticContext()
            context.scope.rootScope.addFunctionDeclaration(
                FunctionDeclaration.create({
                    ...util.someFunctionDeclConfig,
                    baseName: 'foo',
                    result: {
                        isolationLevel: ISOLATED,
                        domain: util.spannedDomain(
                            RCTypeSet.create({
                                type: util.simpleTypeName('MyData'),
                            }),
                        ),
                    },
                    implementation: {
                        kind: 'implicit-return',
                        expression: DataLiteral.create({
                            fields: [],
                            span: util.someCodeSpan,
                        }),
                    },
                }),
            )

            const query = FunctionCall.create({
                baseName: 'foo',
                arguments: [],
                span: util.someCodeSpan,
            })
            const result = query.toCIRExpression(context)
            expect(result.isSuccess && result.value).toMatchObject({
                kind: 'CALL',
                name: {
                    baseName: 'foo',
                    labels: [],
                },
                arguments: [],
            })
        })

        test('for copy(of:) function', () => {
            const context = util.newSemanticContext()
            context.scope.addVariableDeclaration('value', {
                isImmutable: true,
                isolationLevel: SHARED,
                domain: RCTypeSet.create({
                    type: util.simpleTypeName('MyData'),
                }),
            })

            const query = FunctionCall.create({
                baseName: 'copy',
                arguments: [{ label: 'of', value: util.variableRef('value') }],
                span: util.someCodeSpan,
            })
            const result = query.toCIRExpression(context)
            expect(result.isSuccess && result.value).toMatchObject({
                kind: 'CALL',
                name: {
                    baseName: 'copy',
                    labels: ['of'],
                },
                arguments: [
                    {
                        kind: 'VARIABLE_REF',
                        name: 'value',
                    },
                ],
            })
        })
    })

    it('boxes integer literal for printing', () => {
        const statement = FunctionCall.create({
            baseName: 'print',
            arguments: [{ value: util.integerLiteral(1) }],
            span: util.someCodeSpan,
        })
        const context = util.newSemanticContext()
        statement.emitStatement(context)
        expect(context.scope.emitted).toMatchObject([
            {
                kind: 'VARIABLE_DECL',
                name: expect.stringMatching(/^__tempˇ\d+$/),
                initialValue: {
                    kind: 'BOX',
                    expression: {
                        kind: 'INTEGER_LITERAL',
                        value: { max: '1', min: '1' },
                    },
                },
            },
            {
                kind: 'CALL',
                name: {
                    baseName: 'print',
                    labels: [],
                },
                arguments: [
                    {
                        kind: 'VARIABLE_REF',
                        name: expect.stringMatching(/^__tempˇ\d+$/),
                    },
                ],
            },
            {
                kind: 'RELEASE',
                object: {
                    kind: 'VARIABLE_REF',
                    name: expect.stringMatching(/^__tempˇ\d+$/),
                },
            },
        ])
    })

    it('boxes truthvalue for printing', () => {
        const statement = FunctionCall.create({
            baseName: 'print',
            arguments: [{ value: util.truthvalueLiteral('true') }],
            span: util.someCodeSpan,
        })
        const context = util.newSemanticContext()
        statement.emitStatement(context)
        expect(context.scope.emitted).toMatchObject([
            {
                kind: 'VARIABLE_DECL',
                name: expect.stringMatching(/^__tempˇ\d+$/),
                domain: { type: 'truthvalue', values: ['true'] },
                initialValue: {
                    kind: 'BOX',
                    expression: {
                        kind: 'TRUTHVALUE_LITERAL',
                        value: { type: 'truthvalue', values: ['true'] },
                    },
                    value: { type: 'truthvalue', values: ['true'] },
                },
            },
            {
                kind: 'CALL',
                name: {
                    baseName: 'print',
                    labels: [],
                },
                arguments: [
                    {
                        kind: 'VARIABLE_REF',
                        name: expect.stringMatching(/^__tempˇ\d+$/),
                    },
                ],
            },
            {
                kind: 'RELEASE',
                object: {
                    kind: 'VARIABLE_REF',
                    name: expect.stringMatching(/^__tempˇ\d+$/),
                },
            },
        ])
    })

    it('boxes integer variable for printing', () => {
        const context = util.newSemanticContext()
        context.scope.addVariableDeclaration('x', {
            ...util.someIntegerVariable,
            isImmutable: true,
        })

        const statement = FunctionCall.create({
            baseName: 'print',
            arguments: [{ value: util.variableRef('x') }],
            span: util.someCodeSpan,
        })
        const result = statement.emitStatement(context)
        expect(result.isSuccess || result.error.errors).toBeTrue()
        expect(context.scope.emitted).toMatchObject([
            {
                kind: 'VARIABLE_DECL',
                name: expect.stringMatching(/^__tempˇ\d+$/),
                initialValue: {
                    kind: 'BOX',
                    expression: { kind: 'VARIABLE_REF', name: 'x' },
                },
            },
            {
                kind: 'CALL',
                name: {
                    baseName: 'print',
                    labels: [],
                },
                arguments: [
                    {
                        kind: 'VARIABLE_REF',
                        name: expect.stringMatching(/^__tempˇ\d+$/),
                    },
                ],
            },
            {
                kind: 'RELEASE',
                object: {
                    kind: 'VARIABLE_REF',
                    name: expect.stringMatching(/^__tempˇ\d+$/),
                },
            },
        ])
    })

    it('can make direct method call', () => {
        const context = util.newSemanticContext()
        context.scope.rootScope.addObjectDeclaration(
            ObjectDeclaration.create({
                ...util.someObjectDeclConfig,
                name: util.simpleTypeName('Object'),
                readonly: [
                    FunctionDeclaration.create({
                        ...util.someFunctionDeclConfig,
                        baseName: 'read',
                        implementation: {
                            kind: 'implicit-return',
                            expression: util.sharedFieldRef(
                                util.variableRef('self'),
                                'field',
                            ),
                        },
                    }),
                ],
                fields: [
                    {
                        ...util.someFieldDeclConfig,
                        isImmutable: true,
                        name: 'field',
                    },
                ],
            }),
        )
        context.scope.addVariableDeclaration('x', {
            ...util.someIntegerVariable,
            domain: RCTypeSet.create({
                type: util.simpleTypeName('Object'),
            }),
        })

        const call = FunctionCall.create({
            baseName: 'read',
            arguments: [],
            recipient: util.variableRef('x'),
            span: util.someCodeSpan,
        })
        const result = call.toCIRExpression(context)
        expect(result.isSuccess || result.error.errors).toBeTrue()

        expect(result.isSuccess && result.value).toMatchObject({
            kind: 'CALL',
            name: {
                baseName: 'read',
                labels: [],
            },
            receiver: {
                dispatch: 'direct',
                object: {
                    kind: 'VARIABLE_REF',
                    name: 'x',
                },
            },
            arguments: [],
        })
    })
})
