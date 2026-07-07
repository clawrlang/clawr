import { describe, expect, it } from 'bun:test'
import { FunctionName } from '../../../src/model/function-name'

describe('FunctionName', () => {
    describe('toString', () => {
        const cases = {
            'no parameters': {
                baseName: 'foo',
                labels: [],
                arity: 0,
                expected: 'foo()',
            },
            'one labeled parameter': {
                baseName: 'foo',
                labels: ['x'],
                arity: 1,
                expected: 'foo(x:)',
            },
            'one unlabeled parameter': {
                baseName: 'foo',
                labels: [],
                arity: 1,
                expected: 'foo(_:)',
            },
            'multiple labeled parameters': {
                baseName: 'foo',
                labels: ['x', 'y'],
                arity: 2,
                expected: 'foo(x:,y:)',
            },
            'multiple unlabeled parameters': {
                baseName: 'foo',
                labels: [],
                arity: 2,
                expected: 'foo(_:,_:)',
            },
        }
        for (const [
            name,
            { baseName, labels, arity, expected },
        ] of Object.entries(cases)) {
            it(name, () => {
                const functionName = FunctionName.create({
                    baseName,
                    labels,
                    arity,
                })
                expect(functionName.toString()).toBe(expected)
            })
        }
    })
})
