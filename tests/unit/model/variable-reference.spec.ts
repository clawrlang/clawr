import { describe, expect, it } from 'bun:test'
import { VariableReference } from '../../../src/model/variable-reference'
import { newSemanticContext, someCodeSpan } from '../../util'

describe('Variable Reference', () => {
    it('generates correct CIR', () => {
        const variableRef = VariableReference.create({
            name: 'myVar',
            span: someCodeSpan,
        })
        expect(variableRef.toCIR(newSemanticContext())).toEqual({
            kind: 'VARIABLE_REF',
            name: 'myVar',
        })
    })

    it('infers its type from the context', () => {
        const context = newSemanticContext()
        context.scope.variables.set('myVar', { kind: 'const', type: 'integer' })

        const variableRef = VariableReference.create({
            name: 'myVar',
            span: someCodeSpan,
        })
        expect(variableRef.type(context)).toBe('integer')
    })

    describe('infers isolation level from the context', () => {
        const cases = [
            { kind: 'const', expected: true },
            { kind: 'mut', expected: true },
            { kind: 'ref', expected: false },
            { kind: 'mutref', expected: false },
        ] as const

        for (const { kind, expected } of cases) {
            it(`returns ${expected} for ${kind} variable`, () => {
                const context = newSemanticContext()
                context.scope.variables.set('myVar', { kind, type: 'integer' })

                const variableRef = VariableReference.create({
                    name: 'myVar',
                    span: someCodeSpan,
                })
                expect(variableRef.isIsolated(context)).toBe(expected)
            })
        }
    })
})
