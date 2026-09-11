import { describe, expect, it, test } from 'bun:test'
import { newSemanticContext, someCodeSpan } from '@@/util'
import { FunctionCall } from '@/model/function-call'
import { IntegerLiteral } from '@/model/integer-literal'
import { TruthValueLiteral } from '@/model/truthvalue-literal'
import { FunctionDeclaration } from '@/model/function-declaration'
import { Parameter } from '@/model/parameter'
import { DataLiteral } from '@/model/data-literal'
import { IntegerLattice, RCTypeLattice } from '@/model/lattice'
import { VariableReference } from '@/model/variable-reference'
import { TypeName } from '@/model/type-name'
import { ISOLATED, SHARED } from '@/model/isolation-level'
import { decorateLattice } from '@/model/lattice-declaration'
import { Failable, isSuccess } from '@/tools/failable'
import assert from 'assert'

describe('FunctionCall', () => {
    it('converts to CIR', () => {
        const query = FunctionCall.create({
            baseName: 'foo',
            arguments: [],
            span: someCodeSpan,
        })
        const context = newSemanticContext()
        context.scope.rootScope.addFunctionDeclaration(
            FunctionDeclaration.create({
                baseName: 'foo',
                parameters: [],
                result: undefined,
                implementation: {
                    kind: 'implicit-return',
                    expression: IntegerLiteral.create({
                        value: 42n,
                        span: someCodeSpan,
                    }),
                },
            }),
        )
        const result = Failable.do(() => query.toCIRExpression(context))
        assert(isSuccess(result))
        expect(result.value).toMatchObject({
            kind: 'CALL',
            name: {
                baseName: 'foo',
                labels: [],
            },
            arguments: [],
        })
    })

    it('includes argument labels in signature', () => {
        const query = FunctionCall.create({
            baseName: 'foo',
            arguments: [
                {
                    label: 'x',
                    value: IntegerLiteral.create({
                        value: 42n,
                        span: someCodeSpan,
                    }),
                },
            ],
            span: someCodeSpan,
        })
        const context = newSemanticContext()
        context.scope.rootScope.addFunctionDeclaration(
            FunctionDeclaration.create({
                baseName: 'foo',
                parameters: [
                    Parameter.create({
                        label: 'x',
                        isImmutable: true,
                        varName: 'x',
                        isolationLevel: ISOLATED,
                        lattice: decorateLattice(
                            IntegerLattice.create({
                                min: 0n,
                                max: 100n,
                            }),
                            { span: someCodeSpan },
                        ),
                        span: someCodeSpan,
                    }),
                ],
                result: undefined,
                implementation: {
                    kind: 'implicit-return',
                    expression: IntegerLiteral.create({
                        value: 42n,
                        span: someCodeSpan,
                    }),
                },
            }),
        )
        const result = Failable.do(() => query.toCIRExpression(context))
        assert(isSuccess(result))
        expect(result.value).toMatchObject({
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
            const context = newSemanticContext()
            context.scope.rootScope.addFunctionDeclaration(
                FunctionDeclaration.create({
                    baseName: 'foo',
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
                        expression: DataLiteral.create({
                            fields: [],
                            span: someCodeSpan,
                        }),
                    },
                }),
            )

            const query = FunctionCall.create({
                baseName: 'foo',
                arguments: [],
                span: someCodeSpan,
            })
            const result = Failable.do(() => query.toCIRExpression(context))
            assert(isSuccess(result))
            expect(result.value).toMatchObject({
                kind: 'CALL',
                name: {
                    baseName: 'foo',
                    labels: [],
                },
                arguments: [],
            })
        })

        test('for copy(of:) function', () => {
            const context = newSemanticContext()
            context.scope.variables.set('value', {
                isImmutable: true,
                isolationLevel: SHARED,
                lattice: RCTypeLattice.create({
                    type: TypeName.create({ name: 'MyData' }),
                }),
            })
            context.scope.setCurrentValue(
                'value',
                RCTypeLattice.create({
                    type: TypeName.create({ name: 'MyData' }),
                }),
            )

            const query = FunctionCall.create({
                baseName: 'copy',
                arguments: [
                    {
                        label: 'of',
                        value: VariableReference.create({
                            name: 'value',
                            span: someCodeSpan,
                        }),
                    },
                ],
                span: someCodeSpan,
            })
            const result = Failable.do(() => query.toCIRExpression(context))
            assert(isSuccess(result))
            expect(result.value).toMatchObject({
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
            arguments: [
                {
                    value: IntegerLiteral.create({
                        value: 1n,
                        span: someCodeSpan,
                    }),
                },
            ],
            span: someCodeSpan,
        })
        const context = newSemanticContext()
        Failable.do(() => statement.emitStatement(context))
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
            arguments: [
                {
                    value: TruthValueLiteral.create({
                        value: 'true',
                        span: someCodeSpan,
                    }),
                },
            ],
            span: someCodeSpan,
        })
        const context = newSemanticContext()
        Failable.do(() => statement.emitStatement(context))
        expect(context.scope.emitted).toMatchObject([
            {
                kind: 'VARIABLE_DECL',
                name: expect.stringMatching(/^__tempˇ\d+$/),
                lattice: { type: 'truthvalue', values: ['true'] },
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
        const context = newSemanticContext()
        context.scope.variables.set('x', {
            isImmutable: true,
            isolationLevel: ISOLATED,
            lattice: IntegerLattice.create({ min: 42n, max: 42n }),
        })
        context.scope.setCurrentValue(
            'x',
            IntegerLattice.create({ min: 42n, max: 42n }),
        )

        const statement = FunctionCall.create({
            baseName: 'print',
            arguments: [
                {
                    value: VariableReference.create({
                        name: 'x',
                        span: someCodeSpan,
                    }),
                },
            ],
            span: someCodeSpan,
        })
        Failable.do(() => statement.emitStatement(context))
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
})
