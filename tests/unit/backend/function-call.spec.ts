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
                valueSet: { type: 'truthvalue', values: [] },
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
                valueSet: { type: 'truthvalue', values: [] },
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
                valueSet: { type: 'truthvalue', values: [] },
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

    describe('adds namespace to function call when present', () => {
        test('expression', () => {
            const expr: Expression = {
                kind: 'QUERY',
                name: {
                    namespace: 'myNamespace',
                    baseName: 'myFunction',
                    labels: [],
                },
                arguments: [],
                valueSet: { type: 'truthvalue', values: [] },
            }
            const result = lowerExpr(expr)
            expect(result).toBe('myNamespace¸myFunction()')
        })

        test('statement', () => {
            const stmt: Statement = {
                kind: 'EXEC',
                name: {
                    namespace: 'myNamespace',
                    baseName: 'myFunction',
                    labels: [],
                },
                arguments: [],
            }
            const result = lowerStmt(stmt)
            expect(result).toBe('myNamespace¸myFunction();')
        })
    })

    describe('adds receiver to function call when present', () => {
        test('expression', () => {
            const expr: Expression = {
                kind: 'QUERY',
                receiver: {
                    kind: 'VARIABLE_REF',
                    name: 'myObject',
                    valueSet: {
                        type: 'rc-type',
                        typeName: 'Object',
                        semantics: 'ISOLATED',
                    },
                },
                name: {
                    baseName: 'myMethod',
                    labels: [],
                },
                arguments: [],
                valueSet: { type: 'truthvalue', values: [] },
            }
            const result = lowerExpr(expr)
            expect(result).toBe('Object·myMethod(myObject)')
        })

        test('statement', () => {
            const stmt: Statement = {
                kind: 'EXEC',
                receiver: {
                    kind: 'VARIABLE_REF',
                    name: 'myObject',
                    valueSet: {
                        type: 'rc-type',
                        typeName: 'Object',
                        semantics: 'ISOLATED',
                    },
                },
                name: {
                    baseName: 'myMethod',
                    labels: [],
                },
                arguments: [],
            }
            const result = lowerStmt(stmt)
            expect(result).toBe('Object·myMethod(myObject);')
        })
    })
})
