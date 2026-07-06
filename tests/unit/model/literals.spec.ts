import { describe, expect, it } from 'bun:test'
import { Expression } from '../../../src/cir'
import { newSemanticContext, someCodeSpan } from '../../util'
import { TruthValueLiteral } from '../../../src/model/truthvalue-literal'
import { IntegerLiteral } from '../../../src/model/integer-literal'
import { DataLiteral } from '../../../src/model/data-literal'
import { DataDeclaration } from '../../../src/model/data-declaration'

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
                    literal.toCIRExpression(newSemanticContext()),
                ).toMatchObject({
                    kind: 'TRUTHVALUE_LITERAL',
                    value: input,
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
                    literal.toCIRExpression(newSemanticContext()),
                ).toMatchObject({
                    kind: 'INTEGER_LITERAL',
                    value: input,
                })
            })
        }
    })

    describe('data literals', () => {
        it('outputs a data literal as ALLOCATE', () => {
            const context = newSemanticContext()
            context.scope.declarations.set(
                'MyType',
                DataDeclaration.create({
                    name: 'MyType',
                    fields: [
                        {
                            name: 'x',
                            type: 'integer',
                            semantics: 'mut',
                        },
                        {
                            name: 'y',
                            type: 'integer',
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
                dataLiteral.toCIRExpression({
                    ...context,
                    targetValueSet: {
                        type: 'rc-type',
                        typeName: 'MyType',
                        semantics: 'REF',
                    },
                }),
            ).toMatchObject({
                kind: 'ALLOCATE',
                valueSet: {
                    type: 'rc-type',
                    typeName: 'MyType',
                    semantics: 'REF',
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
    })
})

type Truthvalue = Extract<Expression, { kind: 'TRUTHVALUE_LITERAL' }>['value']
