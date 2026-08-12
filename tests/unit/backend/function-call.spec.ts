import { describe, expect, it, test } from 'bun:test'
import { Expression, ClawrModule, Statement } from '../../../src/cir'
import { lower, lowerExpr, lowerStmt } from '../../../src/backend'

describe('Function Calls', () => {
    describe('includes parameter labels in the function name', () => {
        test('expression', () => {
            const expr: Expression = {
                kind: 'CALL',
                name: {
                    baseName: 'myFunction',
                    labels: ['param1', 'param2'],
                },
                arguments: [
                    {
                        kind: 'INTEGER_LITERAL',
                        value: '42',
                    },
                    {
                        kind: 'STRING_LITERAL',
                        value: 'Hello',
                    },
                ],
                valueSet: { type: 'truthvalue', values: [] },
            }
            const result = lowerExpr(expr)
            expect(result).toBe('myFunction˛param1˛param2(42, "Hello")')
        })

        test('statement', () => {
            const stmt: Statement = {
                kind: 'CALL',
                name: {
                    baseName: 'myFunction',
                    labels: ['param1', 'param2'],
                },
                arguments: [
                    {
                        kind: 'INTEGER_LITERAL',
                        value: '42',
                    },
                    {
                        kind: 'STRING_LITERAL',
                        value: 'Hello',
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
                kind: 'CALL',
                name: {
                    baseName: 'myFunction',
                    labels: ['param1'],
                },
                arguments: [
                    {
                        kind: 'INTEGER_LITERAL',
                        value: '42',
                    },
                    {
                        kind: 'STRING_LITERAL',
                        value: 'Hello',
                    },
                ],
                valueSet: { type: 'truthvalue', values: [] },
            }
            const result = lowerExpr(expr)
            expect(result).toBe('myFunction˛param1(42, "Hello")')
        })

        test('statement', () => {
            const stmt: Statement = {
                kind: 'CALL',
                name: {
                    baseName: 'myFunction',
                    labels: ['param1'],
                },
                arguments: [
                    {
                        kind: 'INTEGER_LITERAL',
                        value: '42',
                    },
                    {
                        kind: 'STRING_LITERAL',
                        value: 'Hello',
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
                kind: 'CALL',
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
                kind: 'CALL',
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
                kind: 'CALL',
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
                kind: 'CALL',
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
                kind: 'CALL',
                receiver: {
                    object: {
                        kind: 'VARIABLE_REF',
                        name: 'myObject',
                    },
                    type: { name: 'Object' },
                    dispatch: 'direct',
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
                kind: 'CALL',
                receiver: {
                    object: {
                        kind: 'VARIABLE_REF',
                        name: 'myObject',
                    },
                    type: { name: 'Object' },
                    dispatch: 'direct',
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

    describe('calls through vtable when requested', () => {
        test('expression', () => {
            const expr: Expression = {
                kind: 'CALL',
                receiver: {
                    object: {
                        kind: 'VARIABLE_REF',
                        name: 'myObject',
                    },
                    dispatch: 'inherited',
                    declaredIn: {
                        namespace: 'ns',
                        name: 'Super',
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
            expect(result).toBe(
                'VTABLE(myObject, ns¸Super)->myMethod(myObject)',
            )
        })

        test('statement', () => {
            const stmt: Statement = {
                kind: 'CALL',
                receiver: {
                    object: {
                        kind: 'VARIABLE_REF',
                        name: 'myObject',
                    },
                    dispatch: 'inherited',
                    declaredIn: {
                        namespace: 'ns',
                        name: 'Super',
                    },
                },
                name: {
                    baseName: 'myMethod',
                    labels: [],
                },
                arguments: [],
            }
            const result = lowerStmt(stmt)
            expect(result).toBe(
                'VTABLE(myObject, ns¸Super)->myMethod(myObject);',
            )
        })
    })

    describe('adds receiver namespace to function call when present', () => {
        test('expression', () => {
            const expr: Expression = {
                kind: 'CALL',
                receiver: {
                    object: {
                        kind: 'VARIABLE_REF',
                        name: 'myObject',
                    },
                    type: { name: 'Object', namespace: 'ns' },
                    dispatch: 'direct',
                },
                name: {
                    baseName: 'myMethod',
                    labels: [],
                },
                arguments: [],
                valueSet: { type: 'truthvalue', values: [] },
            }
            const result = lowerExpr(expr)
            expect(result).toBe('ns¸Object·myMethod(myObject)')
        })

        test('statement', () => {
            const stmt: Statement = {
                kind: 'CALL',
                receiver: {
                    object: {
                        kind: 'VARIABLE_REF',
                        name: 'myObject',
                    },
                    type: { name: 'Object', namespace: 'ns' },
                    dispatch: 'direct',
                },
                name: {
                    baseName: 'myMethod',
                    labels: [],
                },
                arguments: [],
            }
            const result = lowerStmt(stmt)
            expect(result).toBe('ns¸Object·myMethod(myObject);')
        })
    })
})
