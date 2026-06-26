import { describe, expect, it, test } from 'bun:test'
import { VariableReference } from '../../../src/model/variable-reference'
import { newSemanticContext, someCodeSpan } from '../../util'

describe('Variable Reference', () => {
    it('generates correct CIR', () => {
        const context = newSemanticContext()
        context.scope.variables.set('myVar', { kind: 'const', type: 'integer' })

        const variableRef = VariableReference.create({
            name: 'myVar',
            span: someCodeSpan,
        })
        expect(variableRef.toCIR(context)).toEqual({
            kind: 'VARIABLE_REF',
            name: 'myVar',
        })
    })

    describe('throws if variable is not in context', () => {
        const variableRef = VariableReference.create({
            name: 'myVar',
            span: someCodeSpan,
        })
        test('toCIR', () => {
            expect(() => variableRef.toCIR(newSemanticContext())).toThrow()
        })
        test('info', () => {
            expect(() => variableRef.valueSet(newSemanticContext())).toThrow()
        })
    })

    it('infers its type from the context', () => {
        const context = newSemanticContext()
        context.scope.variables.set('myVar', { kind: 'const', type: 'integer' })

        const variableRef = VariableReference.create({
            name: 'myVar',
            span: someCodeSpan,
        })
        expect(variableRef.valueSet(context).type).toBe('integer')
    })

    describe('infers isolation level from the context', () => {
        const cases = [
            { kind: 'const', expected: 'COW' },
            { kind: 'mut', expected: 'COW' },
            { kind: 'ref', expected: 'REF' },
            { kind: 'mutref', expected: 'REF' },
        ] as const

        for (const { kind, expected } of cases) {
            it(`returns ${expected} for ${kind} variable`, () => {
                const context = newSemanticContext()
                context.scope.variables.set('myVar', { kind, type: 'integer' })

                const variableRef = VariableReference.create({
                    name: 'myVar',
                    span: someCodeSpan,
                })
                expect(variableRef.valueSet(context).kind).toBe(expected)
            })
        }
    })
})
