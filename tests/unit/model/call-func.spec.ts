import { describe, it, expect } from 'bun:test'
import { CallFunc, IntegerLiteral, TruthValueLiteral } from '../../../src/model'

describe('CallFunc', () => {
    it('parses a simple function call', () => {
        const statement = CallFunc.create({
            baseName: 'foo',
            arguments: [
                { value: IntegerLiteral.create(42n) },
                { value: TruthValueLiteral.create('ambiguous') },
            ],
        })
        expect(statement.toCIR()).toMatchObject({
            type: 'CALL_FUNC',
            signature: {
                baseName: 'foo',
                parameters: [{ type: 'integer' }, { type: 'truthvalue' }],
            },
            arguments: [
                { type: 'INTEGER_LITERAL', value: '42' },
                { type: 'TRUTHVALUE_LITERAL', value: 'ambiguous' },
            ],
        })
    })

    it('converts print(integer) to printInteger()', () => {
        const statement = CallFunc.create({
            baseName: 'print',
            arguments: [{ value: IntegerLiteral.create(1n) }],
        })
        expect(statement.toCIR()).toMatchObject({
            type: 'CALL_FUNC',
            signature: {
                baseName: 'printInteger',
                parameters: [{ type: 'integer' }],
            },
            arguments: [{ type: 'INTEGER_LITERAL', value: '1' }],
        })
    })

    it('converts print(truthvalue) to printTruthvalue()', () => {
        const statement = CallFunc.create({
            baseName: 'print',
            arguments: [{ value: TruthValueLiteral.create('true') }],
        })
        expect(statement.toCIR()).toMatchObject({
            type: 'CALL_FUNC',
            signature: {
                baseName: 'printTruthvalue',
                parameters: [{ type: 'truthvalue' }],
            },
            arguments: [{ type: 'TRUTHVALUE_LITERAL', value: 'true' }],
        })
    })
})
