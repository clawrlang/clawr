import { realOperationResult } from '@/model/operators/real-operation'
import { RealSet } from '@/model/value-set'
import { describe, expect, it } from 'bun:test'

const sig = (digits: number, base: 'dec' | 'bin' | 'ter') =>
    ({ kind: 'sig', digits, base }) as const
const scale = (digits: number, base: 'dec' | 'bin' | 'ter') =>
    ({ kind: 'scale', digits, base }) as const

function precisionOf(result: ReturnType<typeof realOperationResult>) {
    if (result.isError) throw new Error('Expected a value')
    return (result.value as RealSet).precision
}

describe('real operation promotion', () => {
    it('lets a decimal literal adopt a binary precision', () => {
        const literal = RealSet.singleton('0.2' as any, sig(1, 'dec'))
        const operand = RealSet.unconstrained(sig(113, 'bin'))
        const result = realOperationResult(operand, literal)
        expect(precisionOf(result)).toEqual(sig(113, 'bin'))
    })

    it('lets a decimal literal adopt a scale grid', () => {
        const literal = RealSet.singleton('0.2' as any, sig(1, 'dec'))
        const operand = RealSet.unconstrained(scale(3, 'ter'))
        const result = realOperationResult(literal, operand)
        expect(precisionOf(result)).toEqual(scale(3, 'ter'))
    })

    it('rejects other mixed kinds and bases', () => {
        const left = RealSet.unconstrained(sig(10, 'dec'))
        const right = RealSet.unconstrained(scale(3, 'bin'))
        expect(realOperationResult(left, right).isError).toBe(true)
    })

    it('combines binary operands at the higher precision', () => {
        const left = RealSet.unconstrained(sig(20, 'bin'))
        const right = RealSet.unconstrained(sig(53, 'bin'))
        const result = realOperationResult(left, right)
        expect(precisionOf(result)).toEqual(sig(53, 'bin'))
    })
})
