import { describe, expect, it, test } from 'bun:test'
import { VariableReference } from '../../../src/model/variable-reference'
import { newSemanticContext, someCodeSpan } from '../../util'

describe('Variable Reference', () => {
    it('generates correct CIR', () => {
        const context = newSemanticContext()
        context.scope.variables.set('myVar', {
            semantics: 'const',
            type: 'integer',
        })

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
        const span = {
            start: { line: 1, column: 1 },
            end: { line: 1, column: 6 },
        }
        const variableRef = VariableReference.create({ name: 'myVar', span })
        const cases = ['toCIR', 'valueSet'] as const
        for (const method of cases) {
            test(method, () => {
                const context = newSemanticContext()
                const call = () => variableRef[method](context)
                expect(call).toThrow()
                expect(context.errorReporter).toMatchObject({
                    errors: [
                        {
                            message: `Variable myVar is not defined in the current context`,
                            location: span,
                        },
                    ],
                })
            })
        }
    })

    it('infers its type from the context', () => {
        const context = newSemanticContext()
        context.scope.variables.set('myVar', {
            semantics: 'const',
            type: 'integer',
        })

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
                context.scope.variables.set('myVar', {
                    semantics: kind,
                    type: 'integer',
                })

                const variableRef = VariableReference.create({
                    name: 'myVar',
                    span: someCodeSpan,
                })
                expect(variableRef.semantics(context)).toBe(expected)
            })
        }
    })
})
