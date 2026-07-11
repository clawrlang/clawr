import { describe, expect, it, test } from 'bun:test'
import { VariableReference } from '../../../src/model/variable-reference'
import { newSemanticContext, someCodeSpan } from '../../util'
import { DataDeclaration } from '../../../src/model/data-declaration'
import { IntegerValueSet } from '../../../src/model/value-set'

describe('Variable Reference', () => {
    it('generates correct CIR', () => {
        const context = newSemanticContext()
        context.scope.variables.set('myVar', {
            semantics: 'const',
            valueSet: { type: 'integer', min: '10', max: '10' },
        })

        const variableRef = VariableReference.create({
            name: 'myVar',
            span: someCodeSpan,
        })
        expect(variableRef.toCIRExpression(context)).toEqual({
            kind: 'VARIABLE_REF',
            name: 'myVar',
            valueSet: { type: 'integer', min: '10', max: '10' },
        })
    })

    describe('throws if variable is not in context', () => {
        const span = {
            start: { line: 1, column: 1 },
            end: { line: 1, column: 6 },
        }
        const variableRef = VariableReference.create({ name: 'myVar', span })
        const cases = ['toCIRExpression', 'valueSet'] as const
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
            valueSet: { type: 'integer', min: '10', max: '10' },
        })

        const variableRef = VariableReference.create({
            name: 'myVar',
            span: someCodeSpan,
        })
        expect(variableRef.valueSet(context)).toEqual({
            type: 'integer',
            min: '10',
            max: '10',
        })
    })

    describe('infers isolation level from the context', () => {
        const cases = [
            { kind: 'const', expected: 'COW' },
            { kind: 'mut', expected: 'COW' },
            { kind: 'ref', expected: 'REF' },
            { kind: 'mutref', expected: 'REF' },
        ] as const

        const context = newSemanticContext()
        context.scope.rootScope.declarations.set(
            'MyType',
            DataDeclaration.create({
                name: 'MyType',
                fields: [
                    {
                        name: 'myField',
                        valueSet: IntegerValueSet.create({
                            span: someCodeSpan,
                        }),
                        semantics: 'mut',
                    },
                ],
            }),
        )

        for (const { kind, expected } of cases) {
            it(`returns ${expected} for ${kind} variable`, () => {
                context.scope.variables.set('myVar', {
                    semantics: kind,
                    valueSet: {
                        type: 'rc-type',
                        semantics: expected,
                        typeName: 'MyType',
                    },
                })

                const variableRef = VariableReference.create({
                    name: 'myVar',
                    span: someCodeSpan,
                })
                expect(variableRef.valueSet(context)).toMatchObject({
                    semantics: expected,
                })
            })
        }
    })
})
