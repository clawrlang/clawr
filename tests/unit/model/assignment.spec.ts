import { describe, expect, it, test } from 'bun:test'
import { Assignment } from '../../../src/model/assignment'
import { newSemanticContext, someCodeSpan } from '../../util'
import { VariableReference } from '../../../src/model/variable-reference'
import { IntegerLiteral } from '../../../src/model/integer-literal'
import { FieldReference } from '../../../src/model/field-reference'
import { DataDeclaration } from '../../../src/model/data-declaration'

describe('Assignment', () => {
    it('outputs the correct CIR representation', () => {
        const context = newSemanticContext()
        context.scope.variables.set('x', { semantics: 'mut', type: 'integer' })

        const assignment = Assignment.create({
            target: VariableReference.create({ name: 'x', span: someCodeSpan }),
            value: IntegerLiteral.create(42n),
            span: someCodeSpan,
        })

        expect(assignment.toCIR(context)).toMatchObject({
            kind: 'ASSIGN',
            target: { kind: 'VARIABLE_REF', name: 'x' },
            value: { kind: 'INTEGER_LITERAL', value: '42' },
        })
    })

    it('throws if the target variable is not in context', () => {
        const assignment = Assignment.create({
            target: VariableReference.create({
                name: 'x',
                span: {
                    start: { line: 1, column: 1 },
                    end: { line: 1, column: 2 },
                },
            }),
            value: IntegerLiteral.create(42n),
            span: someCodeSpan,
        })
        const context = newSemanticContext()
        expect(() => assignment.toCIR(context)).toThrow()
        expect(context.errorReporter).toMatchObject({
            errors: [
                {
                    message: `Variable x is not defined in the current context`,
                    location: {
                        start: { line: 1, column: 1 },
                        end: { line: 1, column: 2 },
                    },
                },
            ],
        })
    })

    describe('throws if the target variable is immutable/non-assignable', () => {
        for (const kind of ['const', 'ref'] as const) {
            test(kind, () => {
                const context = newSemanticContext()
                context.scope.declarations.set(
                    'MyType',
                    DataDeclaration.create({
                        name: 'MyType',
                        fields: [{ name: 'myField', type: 'integer' }],
                    }),
                )
                context.scope.variables.set('target', {
                    semantics: kind,
                    type: 'MyType',
                })
                context.scope.variables.set('value', {
                    semantics: kind,
                    type: 'MyType',
                })

                const assignment = Assignment.create({
                    target: VariableReference.create({
                        name: 'target',
                        span: {
                            start: { line: 1, column: 1 },
                            end: { line: 1, column: 2 },
                        },
                    }),
                    value: VariableReference.create({
                        name: 'value',
                        span: someCodeSpan,
                    }),
                    span: someCodeSpan,
                })
                expect(() => assignment.toCIR(context)).toThrow()
                expect(context.errorReporter).toMatchObject({
                    errors: [
                        {
                            message: `Variable target is not mutable`,
                            location: {
                                start: { line: 1, column: 1 },
                                end: { line: 1, column: 2 },
                            },
                        },
                    ],
                })
            })
        }
    })

    it('throws if the target field is effectively const', () => {
        const context = newSemanticContext()
        context.scope.declarations.set(
            'MyType',
            DataDeclaration.create({
                name: 'MyType',
                fields: [{ name: 'myField', type: 'integer' }],
            }),
        )
        context.scope.variables.set('x', {
            semantics: 'const',
            type: 'MyType',
        })

        const assignment = Assignment.create({
            target: FieldReference.create({
                object: VariableReference.create({
                    name: 'x',
                    span: someCodeSpan,
                }),
                operator: '.',
                field: 'myField',
                fieldSpan: {
                    start: { line: 1, column: 3 },
                    end: { line: 1, column: 4 },
                },
            }),
            value: IntegerLiteral.create(42n),
            span: someCodeSpan,
        })
        expect(() => assignment.toCIR(context)).toThrow()
        expect(context.errorReporter).toMatchObject({
            errors: [
                {
                    message:
                        'Cannot mutate field myField of a reference type object',
                    location: {
                        start: { line: 1, column: 3 },
                        end: { line: 1, column: 4 },
                    },
                },
            ],
        })
    })

    describe('throws if the value and target have incompatible semantics', () => {
        const cases = [
            { targetSemantics: ['mut', 'COW'], valueSemantics: ['ref', 'REF'] },
            {
                targetSemantics: ['mut', 'COW'],
                valueSemantics: ['mutref', 'REF'],
            },
        ] as const

        cases.forEach(({ targetSemantics, valueSemantics }) => {
            it(`${targetSemantics} target = ${valueSemantics} value`, () => {
                const context = newSemanticContext()
                context.scope.declarations.set(
                    'MyType',
                    DataDeclaration.create({
                        name: 'MyType',
                        fields: [{ name: 'myField', type: 'integer' }],
                    }),
                )
                context.scope.variables.set('target', {
                    semantics: targetSemantics[0],
                    type: 'MyType',
                })
                context.scope.variables.set('value', {
                    semantics: valueSemantics[0],
                    type: 'MyType',
                })

                const assignment = Assignment.create({
                    target: FieldReference.create({
                        object: VariableReference.create({
                            name: 'target',
                            span: someCodeSpan,
                        }),
                        operator: '.',
                        field: 'myField',
                        fieldSpan: someCodeSpan,
                    }),
                    span: {
                        start: { line: 1, column: 3 },
                        end: { line: 1, column: 4 },
                    },
                    value: VariableReference.create({
                        name: 'value',
                        span: someCodeSpan,
                    }),
                })
                expect(() => assignment.toCIR(context)).toThrow()
                expect(context.errorReporter).toMatchObject({
                    errors: [
                        {
                            message: `Cannot assign ${valueSemantics[1]} value to ${targetSemantics[1]} target`,
                            location: {
                                start: { line: 1, column: 3 },
                                end: { line: 1, column: 4 },
                            },
                        },
                    ],
                })
            })
        })
    })
})
