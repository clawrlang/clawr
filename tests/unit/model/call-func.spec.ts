import { describe, it, expect } from 'bun:test'
import { newSemanticContext, someCodeSpan } from '@@/util'
import { CallFunc } from '@/model/call-func'
import { IntegerLiteral } from '@/model/integer-literal'
import { TruthValueLiteral } from '@/model/truthvalue-literal'
import { VariableReference } from '@/model/variable-reference'
import { IntegerLattice } from '@/model/lattice'
import { ISOLATED } from '@/model/isolation-level'
import { Failable } from '@/tools/failable'

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
        Failable.do(() => statement.emitStatement(context))
        expect(context.scope.emitted).toMatchObject([
            {
                kind: 'CALL',
                name: {
                    baseName: 'foo',
                    labels: [],
                },
                arguments: [
                    {
                        kind: 'INTEGER_LITERAL',
                        value: { max: '42', min: '42' },
                    },
                    {
                        kind: 'TRUTHVALUE_LITERAL',
                        value: { values: ['ambiguous'] },
                    },
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
        Failable.do(() => statement.emitStatement(context))
        expect(context.scope.emitted).toMatchObject([
            {
                kind: 'CALL',
                name: {
                    baseName: 'foo',
                    labels: ['x'],
                },
                arguments: [
                    {
                        kind: 'TRUTHVALUE_LITERAL',
                        value: { values: ['ambiguous'] },
                    },
                ],
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
        Failable.do(() => statement.emitStatement(context))
        expect(context.scope.emitted).toMatchObject([
            {
                kind: 'CALL',
                name: {
                    baseName: 'printInt64',
                    labels: [],
                },
                arguments: [
                    { kind: 'INTEGER_LITERAL', value: { max: '1', min: '1' } },
                ],
            },
        ])
    })

    it('boxes truthvalue for printing', () => {
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
        Failable.do(() => statement.emitStatement(context))
        expect(context.scope.emitted).toMatchObject([
            {
                kind: 'VARIABLE_DECL',
                name: expect.stringMatching(/^__tempˇ\d+$/),
                lattice: { type: 'rc-type', name: 'clawr¸TruthvalueBox' },
                initialValue: {
                    kind: 'BOX',
                    expression: {
                        kind: 'TRUTHVALUE_LITERAL',
                        value: { type: 'truthvalue', values: ['true'] },
                    },

                    value: {
                        type: 'rc-type',
                        name: 'TruthvalueBox',
                        namespace: 'clawr',
                    },
                },
            },
            {
                kind: 'CALL',
                name: {
                    baseName: 'print',
                    labels: [],
                },
                arguments: [
                    {
                        kind: 'VARIABLE_REF',
                        name: expect.stringMatching(/^__tempˇ\d+$/),
                    },
                ],
            },
            {
                kind: 'RELEASE',
                object: {
                    kind: 'VARIABLE_REF',
                    name: expect.stringMatching(/^__tempˇ\d+$/),
                },
            },
        ])
    })

    it('converts print(intvar) to printInt64()', () => {
        const context = newSemanticContext()
        context.scope.variables.set('x', {
            isImmutable: true,
            isolationLevel: ISOLATED,
            lattice: IntegerLattice.create({ min: 42n, max: 42n }),
        })
        context.scope.setCurrentValue(
            'x',
            IntegerLattice.create({ min: 42n, max: 42n }),
        )

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
        Failable.do(() => statement.emitStatement(context))
        expect(context.scope.emitted).toMatchObject([
            {
                kind: 'CALL',
                name: {
                    baseName: 'printInt64',
                    labels: [],
                },
                arguments: [{ kind: 'VARIABLE_REF', name: 'x' }],
            },
        ])
    })
})
