import { describe, expect, it } from 'bun:test'
import { newSemanticContext, someCodeSpan } from '../../util'
import { Query } from '../../../src/model/query'
import { IntegerLiteral } from '../../../src/model/integer-literal'
import { FunctionDeclaration } from '../../../src/model/function-declaration'
import { IntegerValueSet, RCTypeValueSet } from '../../../src/model/value-set'
import { DataLiteral } from '../../../src/model/data-literal'

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
                    {
                        label: 'x',
                        varName: 'x',
                        valueSet: IntegerValueSet.create({
                            min: 0n,
                            max: 100n,
                            span: someCodeSpan,
                        }),
                    },
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

    it('converts UNIQUE semantics to COW in CIR', () => {
        const context = newSemanticContext()
        context.scope.rootScope.declarations.set(
            'foo()',
            FunctionDeclaration.create({
                baseName: 'foo',
                parameters: [],
                result: RCTypeValueSet.create({
                    typeName: 'MyData',
                    semantics: undefined,
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
                semantics: 'COW',
            },
        })
    })
})
