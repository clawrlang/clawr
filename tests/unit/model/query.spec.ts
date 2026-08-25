import { describe, expect, it, test } from 'bun:test'
import { newSemanticContext, someCodeSpan } from '../../util'
import { Query } from '../../../src/model/query'
import { IntegerLiteral } from '../../../src/model/integer-literal'
import { FunctionDeclaration } from '../../../src/model/function-declaration'
import { Parameter } from '../../../src/model/parameter'
import { DataLiteral } from '../../../src/model/data-literal'
import { IntegerLattice, RCTypeLattice } from '../../../src/model/lattice'
import { VariableReference } from '../../../src/model/variable-reference'
import { TypeName } from '../../../src/model/type-name'
import { ISOLATED, SHARED } from '../../../src/model/isolation-level'
import { decorateLattice } from '../../../src/model/lattice-declaration'
import { Failable, isSuccess } from '../../../src/model/gen-failable'
import assert from 'assert'

describe('Query', () => {
    it('converts to CIR', () => {
        const query = Query.create({
            baseName: 'foo',
            arguments: [],
            span: someCodeSpan,
        })
        const context = newSemanticContext()
        context.scope.rootScope.addFunctionDeclaration(
            'foo()',
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
        const query = Query.create({
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
            'foo(x:)',
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
                'foo()',
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

            const query = Query.create({
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

            const query = Query.create({
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
})
