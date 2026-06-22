import { describe, it, expect } from 'bun:test'
import { CallFunc, IntegerLiteral, TruthValueLiteral } from '../../../src/model'

describe('CallFunc', () => {
    it('converts to CIR', () => {
        const statement = CallFunc.create({
            baseName: 'foo',
            arguments: [
                { value: IntegerLiteral.create(42n) },
                { value: TruthValueLiteral.create('ambiguous') },
            ],
        })
        expect(statement.toCIR()).toMatchObject({
            kind: 'CALL_FUNC',
            signature: {
                baseName: 'foo',
                parameters: [{ type: 'integer' }, { type: 'truthvalue' }],
            },
            arguments: [
                { kind: 'INTEGER_LITERAL', value: '42' },
                { kind: 'TRUTHVALUE_LITERAL', value: 'ambiguous' },
            ],
        })
    })

    it('includes argument labels in signature', () => {
        const statement = CallFunc.create({
            baseName: 'foo',
            arguments: [
                { label: 'x', value: TruthValueLiteral.create('ambiguous') },
            ],
        })
        expect(statement.toCIR()).toMatchObject({
            kind: 'CALL_FUNC',
            signature: {
                baseName: 'foo',
                parameters: [{ label: 'x', type: 'truthvalue' }],
            },
            arguments: [{ kind: 'TRUTHVALUE_LITERAL', value: 'ambiguous' }],
        })
    })

    it('converts print(integer) to printInteger()', () => {
        const statement = CallFunc.create({
            baseName: 'print',
            arguments: [{ value: IntegerLiteral.create(1n) }],
        })
        expect(statement.toCIR()).toMatchObject({
            kind: 'CALL_FUNC',
            signature: {
                baseName: 'printInteger',
                parameters: [{ type: 'integer' }],
            },
            arguments: [{ kind: 'INTEGER_LITERAL', value: '1' }],
        })
    })

    it('converts print(truthvalue) to printTruthvalue()', () => {
        const statement = CallFunc.create({
            baseName: 'print',
            arguments: [{ value: TruthValueLiteral.create('true') }],
        })
        expect(statement.toCIR()).toMatchObject({
            kind: 'CALL_FUNC',
            signature: {
                baseName: 'printTruthvalue',
                parameters: [{ type: 'truthvalue' }],
            },
            arguments: [{ kind: 'TRUTHVALUE_LITERAL', value: 'true' }],
        })
    })
})
