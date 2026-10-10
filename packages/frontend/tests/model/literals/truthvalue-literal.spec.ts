import { truthvalue } from '@/model/value-set'
import * as util from '@@/util'
import { describe, expect, it } from 'bun:test'

describe('TruthvalueLiteral', () => {
    const cases: truthvalue[] = ['true', 'false', 'ambiguous'] as const
    for (const input of cases) {
        it(`outputs ${input} as TRUTHVALUE_LITERAL`, () => {
            const literal = util.truthvalueLiteral(input)
            const result = literal.toCIRExpression()
            expect(result.isSuccess && result.value).toMatchObject({
                kind: 'TRUTHVALUE_LITERAL',
                domain: { values: [input] },
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
