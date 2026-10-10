import * as util from '@@/util'
import { describe, expect, it } from 'bun:test'

describe('IntegerLiteral', () => {
    const cases = ['0', '1', '2', '-1', '123456789'] as const
    for (const input of cases) {
        it(`outputs ${input} as INTEGER_LITERAL`, () => {
            const literal = util.integerLiteral(BigInt(input))
            const result = literal.toCIRExpression()
            expect(result.isSuccess && result.value).toMatchObject({
                kind: 'INTEGER_LITERAL',
                domain: { max: input, min: input },
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
