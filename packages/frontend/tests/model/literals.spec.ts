import { DataDeclaration } from '@/model/data-declaration'
import { DataLiteral } from '@/model/data-literal'
import { SHARED } from '@/model/isolation-level'
import { TypeName } from '@/model/type-name'
import { RCTypeSet, truthvalue } from '@/model/value-set'
import * as util from '@@/util'
import { describe, expect, it } from 'bun:test'

describe('Literals', () => {
    describe('truthvalue literals', () => {
        const cases: truthvalue[] = ['true', 'false', 'ambiguous'] as const
        for (const input of cases) {
            it(`outputs ${input} as TRUTHVALUE_LITERAL`, () => {
                const literal = util.truthvalueLiteral(input)
                const result = literal.toCIRExpression()
                expect(result.isSuccess && result.value).toMatchObject({
                    kind: 'TRUTHVALUE_LITERAL',
                    value: { values: [input] },
                })
            })

            it('has a current value set of the literal value', () => {
                const literal = util.truthvalueLiteral(input)
                const result = literal.currentValue()
                expect(result.isSuccess && result.value).toMatchObject({
                    values: [input],
                })
            })
        }
    })

    describe('integer literals', () => {
        const cases = ['0', '1', '2', '-1', '123456789'] as const
        for (const input of cases) {
            it(`outputs ${input} as INTEGER_LITERAL`, () => {
                const literal = util.integerLiteral(BigInt(input))
                const result = literal.toCIRExpression()
                expect(result.isSuccess && result.value).toMatchObject({
                    kind: 'INTEGER_LITERAL',
                    value: { max: input, min: input },
                })
            })

            it('has a current value set of the literal value', () => {
                const literal = util.integerLiteral(BigInt(input))
                const result = literal.currentValue()
                expect(result.value).toMatchObject({
                    min: BigInt(input),
                    max: BigInt(input),
                })
            })
        }
    })

    describe('data literals', () => {
        it('outputs a data literal as ALLOCATE', () => {
            const context = util.newSemanticContext()
            context.scope.rootScope.addDataDeclaration(
                DataDeclaration.create({
                    name: TypeName.create({ name: 'MyType' }),
                    fields: [
                        { ...util.someFieldDeclConfig, name: 'x' },
                        { ...util.someFieldDeclConfig, name: 'y' },
                    ],
                }),
            )

            const dataLiteral = DataLiteral.create({
                fields: [
                    { name: 'x', value: util.integerLiteral(42) },
                    { name: 'y', value: util.integerLiteral(17) },
                ],
                span: util.someCodeSpan,
            })

            const result = dataLiteral.toCIRExpression({
                ...context,
                explicitDomain: RCTypeSet.create({
                    type: util.simpleTypeName('MyType'),
                }),
                isolationLevel: SHARED,
            })
            expect(result.isSuccess && result.value).toMatchObject({
                kind: 'ALLOCATION',
                fields: [
                    {
                        name: 'x',
                        value: {
                            kind: 'INTEGER_LITERAL',
                            value: { max: '42', min: '42' },
                        },
                    },
                    {
                        name: 'y',
                        value: {
                            kind: 'INTEGER_LITERAL',
                            value: { max: '17', min: '17' },
                        },
                    },
                ],
            })
        })

        it('has a current value set of the literal value', () => {
            const context = util.newSemanticContext()
            context.scope.rootScope.addDataDeclaration(
                DataDeclaration.create({
                    name: util.simpleTypeName('MyType'),
                    fields: [
                        { ...util.someFieldDeclConfig, name: 'x' },
                        { ...util.someFieldDeclConfig, name: 'y' },
                    ],
                }),
            )

            const dataLiteral = DataLiteral.create({
                fields: [
                    { name: 'x', value: util.integerLiteral(42) },
                    { name: 'y', value: util.integerLiteral(17) },
                ],
                span: util.someCodeSpan,
            })

            const result = dataLiteral.currentValue({
                ...context,
                explicitDomain: RCTypeSet.create({
                    type: util.simpleTypeName('MyType'),
                }),
            })
            expect(result.isSuccess && result.value).toMatchObject({
                type: { name: 'MyType' },
                fields: {
                    x: { min: 42n, max: 42n },
                    y: { min: 17n, max: 17n },
                },
            })
        })

        it('returns a failure from a nested field value', () => {
            const context = util.newSemanticContext()
            context.scope.rootScope.addDataDeclaration(
                DataDeclaration.create({
                    name: util.simpleTypeName('OuterType'),
                    fields: [
                        {
                            ...util.someFieldDeclConfig,
                            name: 'inner',
                            domain: util.spannedDomain(
                                RCTypeSet.create({
                                    type: util.simpleTypeName(
                                        'MissingInnerType',
                                    ),
                                }),
                            ),
                        },
                    ],
                }),
            )

            const dataLiteral = DataLiteral.create({
                fields: [
                    {
                        name: 'inner',
                        value: DataLiteral.create({
                            fields: [
                                {
                                    name: 'value',
                                    value: util.integerLiteral(7),
                                },
                            ],
                            span: util.someCodeSpan,
                        }),
                    },
                ],
                span: util.someCodeSpan,
            })

            const result = dataLiteral.currentValue({
                ...context,
                explicitDomain: RCTypeSet.create({
                    type: util.simpleTypeName('OuterType'),
                }),
            })
            expect(result.isError).toBeTrue()
        })
    })
})
