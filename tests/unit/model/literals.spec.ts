import { describe, expect, it } from 'bun:test'
import { Expression } from '../../../src/cir'
import {
    DataLiteral,
    IntegerLiteral,
    TruthValueLiteral,
} from '../../../src/model'
import { newSemanticContext } from '../../util'

describe('Literals', () => {
    describe('truthvalue literals', () => {
        const cases: Truthvalue[] = ['true', 'false', 'ambiguous'] as const
        for (const input of cases) {
            it(`outputs ${input} as TRUTHVALUE_LITERAL`, () => {
                const literal = TruthValueLiteral.create(input)
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
                const literal = IntegerLiteral.create(BigInt(input))
                expect(literal.toCIR(newSemanticContext())).toMatchObject({
                    kind: 'INTEGER_LITERAL',
                    value: input,
                })
            })
        }
    })

    describe('data literals', () => {
        it('outputs a data literal as DATA_LITERAL', () => {
            const dataLiteral = new DataLiteral([
                { name: 'x', value: IntegerLiteral.create(42n) },
                { name: 'y', value: IntegerLiteral.create(17n) },
            ])

            expect(dataLiteral.toCIR(newSemanticContext())).toMatchObject({
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
