import { describe, expect, it, test } from 'bun:test'
import { Expression, Statement } from '../../../src/cir'
import { lowerExpr, lowerStmt } from '../../../src/backend'

describe('Function Calls', () => {
    describe('includes parameter labels in the function name', () => {
        test('expression', () => {
            const expr: Expression = {
                kind: 'QUERY',
                name: {
                    baseName: 'myFunction',
                    labels: ['param1', 'param2'],
                },
                arguments: [
                    {
                        kind: 'INTEGER_LITERAL',
                        value: '42',
                        valueSet: { type: 'integer', min: '42', max: '42' },
                    },
                    {
                        kind: 'STRING_LITERAL',
                        value: 'Hello',
                        valueSet: { type: 'string' },
                    },
                ],
                valueSet: { type: 'truthvalue' },
            }
            const result = lowerExpr(expr)
            expect(result).toBe('myFunction˛param1˛param2(42, "Hello")')
        })

        test('statement', () => {
            const stmt: Statement = {
                kind: 'EXEC',
                name: {
                    baseName: 'myFunction',
                    labels: ['param1', 'param2'],
                },
                arguments: [
                    {
                        kind: 'INTEGER_LITERAL',
                        value: '42',
                        valueSet: { type: 'integer', min: '42', max: '42' },
                    },
                    {
                        kind: 'STRING_LITERAL',
                        value: 'Hello',
                        valueSet: { type: 'string' },
                    },
                ],
            }
            const result = lowerStmt(stmt)
            expect(result).toBe('myFunction˛param1˛param2(42, "Hello");')
        })
    })

    describe('skips parameters without labels', () => {
        test('expression', () => {
            const expr: Expression = {
                kind: 'QUERY',
                name: {
                    baseName: 'myFunction',
                    labels: ['param1'],
                },
                arguments: [
                    {
                        kind: 'INTEGER_LITERAL',
                        value: '42',
                        valueSet: { type: 'integer', min: '42', max: '42' },
                    },
                    {
                        kind: 'STRING_LITERAL',
                        value: 'Hello',
                        valueSet: { type: 'string' },
                    },
                ],
                valueSet: { type: 'truthvalue' },
            }
            const result = lowerExpr(expr)
            expect(result).toBe('myFunction˛param1(42, "Hello")')
        })

        test('statement', () => {
            const stmt: Statement = {
                kind: 'EXEC',
                name: {
                    baseName: 'myFunction',
                    labels: ['param1'],
                },
                arguments: [
                    {
                        kind: 'INTEGER_LITERAL',
                        value: '42',
                        valueSet: { type: 'integer', min: '42', max: '42' },
                    },
                    {
                        kind: 'STRING_LITERAL',
                        value: 'Hello',
                        valueSet: { type: 'string' },
                    },
                ],
            }
            const result = lowerStmt(stmt)
            expect(result).toBe('myFunction˛param1(42, "Hello");')
        })
    })

    describe('handles function calls with no parameters', () => {
        test('expression', () => {
            const expr: Expression = {
                kind: 'QUERY',
                name: {
                    baseName: 'noParamFunction',
                    labels: [],
                },
                arguments: [],
                valueSet: { type: 'truthvalue' },
            }
            const result = lowerExpr(expr)
            expect(result).toBe('noParamFunction()')
        })

        test('statement', () => {
            const stmt: Statement = {
                kind: 'EXEC',
                name: {
                    baseName: 'noParamFunction',
                    labels: [],
                },
                arguments: [],
            }
            const result = lowerStmt(stmt)
            expect(result).toBe('noParamFunction();')
        })
    })
})
