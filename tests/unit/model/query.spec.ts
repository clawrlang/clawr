import { describe, expect, it, test } from 'bun:test'
import { newSemanticContext, someCodeSpan } from '../../util'
import { Query } from '../../../src/model/query'
import { IntegerLiteral } from '../../../src/model/integer-literal'
import {
    FunctionDeclaration,
    Parameter,
} from '../../../src/model/function-declaration'
import {
    ExplicitIntegerValueSet,
    ExplicitUniqueValueSet,
} from '../../../src/model/explicit-value-set'
import { DataLiteral } from '../../../src/model/data-literal'
import { SharedTypeLattice } from '../../../src/model/lattice'
import { VariableReference } from '../../../src/model/variable-reference'

describe('Query', () => {
    it('converts to CIR', () => {
        const query = Query.create({
            baseName: 'foo',
            arguments: [],
            span: someCodeSpan,
        })
        const context = newSemanticContext()
        context.scope.rootScope.declarations.set(
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
        expect(query.toCIRExpression(context)).toMatchObject({
            kind: 'QUERY',
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
        context.scope.rootScope.declarations.set(
            'foo(x:)',
            FunctionDeclaration.create({
                baseName: 'foo',
                parameters: [
                    Parameter.create({
                        label: 'x',
                        varName: 'x',
                        valueSet: ExplicitIntegerValueSet.create({
                            min: 0n,
                            max: 100n,
                            span: someCodeSpan,
                        }),
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
        expect(query.toCIRExpression(context)).toMatchObject({
            kind: 'QUERY',
            name: {
                baseName: 'foo',
                labels: ['x'],
            },
            arguments: [
                {
                    kind: 'INTEGER_LITERAL',
                    value: '42',
                },
            ],
        })
    })

    describe('converts UNIQUE semantics to ISOLATED in CIR', () => {
        test('for custom function', () => {
            const context = newSemanticContext()
            context.scope.rootScope.declarations.set(
                'foo()',
                FunctionDeclaration.create({
                    baseName: 'foo',
                    parameters: [],
                    result: ExplicitUniqueValueSet.create({
                        typeName: 'MyData',
                        span: someCodeSpan,
                    }),
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
            expect(query.toCIRExpression(context)).toMatchObject({
                kind: 'QUERY',
                name: {
                    baseName: 'foo',
                    labels: [],
                },
                arguments: [],
                valueSet: {
                    type: 'rc-type',
                    typeName: 'MyData',
                    semantics: 'ISOLATED',
                },
            })
        })

        test('for copy(of:) function', () => {
            const context = newSemanticContext()
            context.scope.variables.set('value', {
                semantics: 'ref',
                valueSet: {
                    type: 'rc-type',
                    typeName: 'MyData',
                    semantics: 'SHARED',
                },
            })
            context.scope.setCurrentValue(
                'value',
                SharedTypeLattice.create({ typeName: 'MyData' }),
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
            expect(query.toCIRExpression(context)).toMatchObject({
                kind: 'QUERY',
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
                valueSet: {
                    type: 'rc-type',
                    typeName: 'MyData',
                    semantics: 'ISOLATED',
                },
            })
        })
    })
})
