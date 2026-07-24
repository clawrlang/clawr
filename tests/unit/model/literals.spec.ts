import { describe, expect, it } from 'bun:test'
import { Expression } from '../../../src/cir'
import { newSemanticContext, someCodeSpan } from '../../util'
import { TruthValueLiteral } from '../../../src/model/truthvalue-literal'
import { IntegerLiteral } from '../../../src/model/integer-literal'
import { DataLiteral } from '../../../src/model/data-literal'
import { TypeDeclaration } from '../../../src/model/type-declaration'
import {
    ExplicitIntegerValueSet,
    ExplicitRCTypeValueSet,
} from '../../../src/model/explicit-value-set'

describe('Literals', () => {
    describe('truthvalue literals', () => {
        const cases: Truthvalue[] = ['true', 'false', 'ambiguous'] as const
        for (const input of cases) {
            it(`outputs ${input} as TRUTHVALUE_LITERAL`, () => {
                const literal = TruthValueLiteral.create({
                    value: input,
                    span: someCodeSpan,
                })
                expect(
                    literal.toCIRExpression(newSemanticContext()).value(),
                ).toMatchObject({
                    kind: 'TRUTHVALUE_LITERAL',
                    value: input,
                })
            })

            it('has a current value set of the literal value', () => {
                const literal = TruthValueLiteral.create({
                    value: input,
                    span: someCodeSpan,
                })
                expect(
                    literal.currentValue(newSemanticContext()).value(),
                ).toMatchObject({
                    values: [input],
                })
            })
        }
    })

    describe('integer literals', () => {
        const cases = ['0', '1', '2', '-1', '123456789'] as const
        for (const input of cases) {
            it(`outputs ${input} as INTEGER_LITERAL`, () => {
                const literal = IntegerLiteral.create({
                    value: BigInt(input),
                    span: someCodeSpan,
                })
                expect(
                    literal.toCIRExpression(newSemanticContext()).value(),
                ).toMatchObject({
                    kind: 'INTEGER_LITERAL',
                    value: input,
                })
            })

            it('has a current value set of the literal value', () => {
                const literal = IntegerLiteral.create({
                    value: BigInt(input),
                    span: someCodeSpan,
                })
                expect(
                    literal.currentValue(newSemanticContext()).value(),
                ).toMatchObject({
                    min: BigInt(input),
                    max: BigInt(input),
                })
            })
        }
    })

    describe('data literals', () => {
        it('outputs a data literal as ALLOCATE', () => {
            const context = newSemanticContext()
            context.scope.rootScope.declarations.set(
                'MyType',
                TypeDeclaration.create({
                    name: 'MyType',
                    fields: [
                        {
                            name: 'x',
                            valueSet: ExplicitIntegerValueSet.create({
                                span: someCodeSpan,
                            }),
                            semantics: 'mut',
                        },
                        {
                            name: 'y',
                            valueSet: ExplicitIntegerValueSet.create({
                                span: someCodeSpan,
                            }),
                            semantics: 'mut',
                        },
                    ],
                }),
            )

            const dataLiteral = DataLiteral.create({
                fields: [
                    {
                        name: 'x',
                        value: IntegerLiteral.create({
                            value: 42n,
                            span: someCodeSpan,
                        }),
                    },
                    {
                        name: 'y',
                        value: IntegerLiteral.create({
                            value: 17n,
                            span: someCodeSpan,
                        }),
                    },
                ],
                span: someCodeSpan,
            })

            expect(
                dataLiteral
                    .toCIRExpression({
                        ...context,
                        targetValueSet: {
                            type: 'rc-type',
                            typeName: 'MyType',
                            semantics: 'SHARED',
                        },
                    })
                    .value(),
            ).toMatchObject({
                kind: 'ALLOCATE',
                valueSet: {
                    type: 'rc-type',
                    typeName: 'MyType',
                    semantics: 'SHARED',
                },
                fields: [
                    {
                        name: 'x',
                        value: { kind: 'INTEGER_LITERAL', value: '42' },
                    },
                    {
                        name: 'y',
                        value: { kind: 'INTEGER_LITERAL', value: '17' },
                    },
                ],
            })
        })

        it('has a current value set of the literal value', () => {
            const context = newSemanticContext()
            context.scope.rootScope.declarations.set(
                'MyType',
                TypeDeclaration.create({
                    name: 'MyType',
                    fields: [
                        {
                            name: 'x',
                            valueSet: ExplicitIntegerValueSet.create({
                                span: someCodeSpan,
                            }),
                            semantics: 'mut',
                        },
                        {
                            name: 'y',
                            valueSet: ExplicitIntegerValueSet.create({
                                span: someCodeSpan,
                            }),
                            semantics: 'mut',
                        },
                    ],
                }),
            )

            const dataLiteral = DataLiteral.create({
                fields: [
                    {
                        name: 'x',
                        value: IntegerLiteral.create({
                            value: 42n,
                            span: someCodeSpan,
                        }),
                    },
                    {
                        name: 'y',
                        value: IntegerLiteral.create({
                            value: 17n,
                            span: someCodeSpan,
                        }),
                    },
                ],
                span: someCodeSpan,
            })

            expect(
                dataLiteral
                    .currentValue({
                        ...context,
                        ...{ typeName: 'MyType' },
                    })
                    .value(),
            ).toMatchObject({
                typeName: 'MyType',
                fields: {
                    x: { min: 42n, max: 42n },
                    y: { min: 17n, max: 17n },
                },
            })
        })

        it('returns a failure from a nested field value', () => {
            const context = newSemanticContext()
            context.scope.rootScope.declarations.set(
                'OuterType',
                TypeDeclaration.create({
                    name: 'OuterType',
                    fields: [
                        {
                            name: 'inner',
                            valueSet: ExplicitRCTypeValueSet.create({
                                typeName: 'MissingInnerType',
                                semantics: 'mut',
                                span: someCodeSpan,
                            }),
                            semantics: 'mut',
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
                                    value: IntegerLiteral.create({
                                        value: 7n,
                                        span: someCodeSpan,
                                    }),
                                },
                            ],
                            span: someCodeSpan,
                        }),
                    },
                ],
                span: someCodeSpan,
            })

            expect(
                dataLiteral
                    .currentValue({
                        ...context,
                        typeName: 'OuterType',
                    })
                    .isFailure(),
            ).toBe(true)
        })
    })
})

type Truthvalue = Extract<Expression, { kind: 'TRUTHVALUE_LITERAL' }>['value']
