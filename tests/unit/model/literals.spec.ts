import { describe, expect, it } from 'bun:test'
import { Expression } from '../../../src/cir'
import { newSemanticContext, someCodeSpan } from '../../util'
import { TruthValueLiteral } from '../../../src/model/truthvalue-literal'
import { IntegerLiteral } from '../../../src/model/integer-literal'
import { DataLiteral } from '../../../src/model/data-literal'

describe('Literals', () => {
    describe('truthvalue literals', () => {
        const cases: Truthvalue[] = ['true', 'false', 'ambiguous'] as const
        for (const input of cases) {
            it(`outputs ${input} as TRUTHVALUE_LITERAL`, () => {
                const literal = TruthValueLiteral.create({
                    value: input,
                    span: someCodeSpan,
                })
                expect(literal.toCIR(newSemanticContext())).toMatchObject({
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
                expect(literal.toCIR(newSemanticContext())).toMatchObject({
                    kind: 'INTEGER_LITERAL',
                    value: input,
                })
            })
        }
    })

    describe('data literals', () => {
        it('outputs a data literal as DATA_LITERAL', () => {
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
                dataLiteral.toCIR({ ...newSemanticContext(), type: 'MyType' }),
            ).toMatchObject({
                kind: 'DATA_LITERAL',
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
