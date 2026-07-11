import { describe, it, expect } from 'bun:test'
import { newSemanticContext, someCodeSpan } from '../../util'
import { CallFunc } from '../../../src/model/call-func'
import { IntegerLiteral } from '../../../src/model/integer-literal'
import { TruthValueLiteral } from '../../../src/model/truthvalue-literal'
import { VariableReference } from '../../../src/model/variable-reference'

describe('CallFunc', () => {
    it('converts to CIR', () => {
        const statement = CallFunc.create({
            baseName: 'foo',
            arguments: [
                {
                    value: IntegerLiteral.create({
                        value: 42n,
                        span: someCodeSpan,
                    }),
                },
                {
                    value: TruthValueLiteral.create({
                        value: 'ambiguous',
                        span: someCodeSpan,
                    }),
                },
            ],
        })
        const context = newSemanticContext()
        statement.emitStatement(context)
        expect(context.scope.emitted).toMatchObject([
            {
                kind: 'EXEC',
                name: {
                    baseName: 'foo',
                    labels: [],
                },
                arguments: [
                    { kind: 'INTEGER_LITERAL', value: '42' },
                    { kind: 'TRUTHVALUE_LITERAL', value: 'ambiguous' },
                ],
            },
        ])
    })

    it('includes argument labels in signature', () => {
        const statement = CallFunc.create({
            baseName: 'foo',
            arguments: [
                {
                    label: 'x',
                    value: TruthValueLiteral.create({
                        value: 'ambiguous',
                        span: someCodeSpan,
                    }),
                },
            ],
        })
        const context = newSemanticContext()
        statement.emitStatement(context)
        expect(context.scope.emitted).toMatchObject([
            {
                kind: 'EXEC',
                name: {
                    baseName: 'foo',
                    labels: ['x'],
                },
                arguments: [{ kind: 'TRUTHVALUE_LITERAL', value: 'ambiguous' }],
            },
        ])
    })

    it('converts print(integer) to printInteger()', () => {
        const statement = CallFunc.create({
            baseName: 'print',
            arguments: [
                {
                    value: IntegerLiteral.create({
                        value: 1n,
                        span: someCodeSpan,
                    }),
                },
            ],
        })
        const context = newSemanticContext()
        statement.emitStatement(context)
        expect(context.scope.emitted).toMatchObject([
            {
                kind: 'EXEC',
                name: {
                    baseName: 'printInt64',
                    labels: [],
                },
                arguments: [{ kind: 'INTEGER_LITERAL', value: '1' }],
            },
        ])
    })

    it('converts print(truthvalue) to printTruthvalue()', () => {
        const statement = CallFunc.create({
            baseName: 'print',
            arguments: [
                {
                    value: TruthValueLiteral.create({
                        value: 'true',
                        span: someCodeSpan,
                    }),
                },
            ],
        })
        const context = newSemanticContext()
        statement.emitStatement(context)
        expect(context.scope.emitted).toMatchObject([
            {
                kind: 'EXEC',
                name: {
                    baseName: 'printTruthvalue',
                    labels: [],
                },
                arguments: [{ kind: 'TRUTHVALUE_LITERAL', value: 'true' }],
            },
        ])
    })

    it('converts print(intvar) to printInt64()', () => {
        const context = newSemanticContext()
        context.scope.variables.set('x', {
            semantics: 'const',
            allowedValues: { type: 'integer', min: '42', max: '42' },
        })

        const statement = CallFunc.create({
            baseName: 'print',
            arguments: [
                {
                    value: VariableReference.create({
                        name: 'x',
                        span: someCodeSpan,
                    }),
                },
            ],
        })
        statement.emitStatement(context)
        expect(context.scope.emitted).toMatchObject([
            {
                kind: 'EXEC',
                name: {
                    baseName: 'printInt64',
                    labels: [],
                },
                arguments: [{ kind: 'VARIABLE_REF', name: 'x' }],
            },
        ])
    })
})
