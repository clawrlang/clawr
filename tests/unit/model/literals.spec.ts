import { describe, expect, it } from 'bun:test'
import { Expression } from '../../../src/cir'
import { IntegerLiteral, TruthValueLiteral } from '../../../src/model'
import { TestErrorReporter } from '../../util'

describe('Literals', () => {
    describe('truthvalue literals', () => {
        const cases: Truthvalue[] = ['true', 'false', 'ambiguous'] as const
        for (const input of cases) {
            it(`outputs ${input} as TRUTHVALUE_LITERAL`, () => {
                const literal = TruthValueLiteral.create(input)
                expect(literal.toCIR(emptyContext)).toMatchObject({
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
                expect(literal.toCIR(emptyContext)).toMatchObject({
                    kind: 'INTEGER_LITERAL',
                    value: input,
                })
            })
        }
    })
})

type Truthvalue = Extract<Expression, { kind: 'TRUTHVALUE_LITERAL' }>['value']

const emptyContext = {
    variableTypes: new Map(),
    errorReporter: new TestErrorReporter('test.clawr'),
}
