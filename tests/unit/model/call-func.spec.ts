import { describe, it, expect } from 'bun:test'
import {
    CallFunc,
    IntegerLiteral,
    TruthValueLiteral,
    VariableReference,
} from '../../../src/model'
import { newSemanticContext } from '../../util'

describe('CallFunc', () => {
    it('converts to CIR', () => {
        const statement = CallFunc.create({
            baseName: 'foo',
            arguments: [
                { value: IntegerLiteral.create(42n) },
                { value: TruthValueLiteral.create('ambiguous') },
            ],
        })
        expect(statement.toCIR(newSemanticContext())).toMatchObject({
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
        expect(statement.toCIR(newSemanticContext())).toMatchObject({
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
        expect(statement.toCIR(newSemanticContext())).toMatchObject({
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
        expect(statement.toCIR(newSemanticContext())).toMatchObject({
            kind: 'CALL_FUNC',
            signature: {
                baseName: 'printTruthvalue',
                parameters: [{ type: 'truthvalue' }],
            },
            arguments: [{ kind: 'TRUTHVALUE_LITERAL', value: 'true' }],
        })
    })

    it('converts print(intvar) to printInteger()', () => {
        const context = newSemanticContext()
        context.variableTypes.set('x', 'integer')

        const statement = CallFunc.create({
            baseName: 'print',
            arguments: [{ value: VariableReference.create('x') }],
        })
        expect(statement.toCIR(context)).toMatchObject({
            kind: 'CALL_FUNC',
            signature: {
                baseName: 'printInteger',
                parameters: [{ type: 'integer' }],
            },
            arguments: [{ kind: 'VARIABLE_REF', name: 'x' }],
        })
    })
})
