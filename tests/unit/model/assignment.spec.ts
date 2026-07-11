import { describe, expect, it, test } from 'bun:test'
import { Assignment } from '../../../src/model/assignment'
import { newSemanticContext, someCodeSpan } from '../../util'
import { VariableReference } from '../../../src/model/variable-reference'
import { IntegerLiteral } from '../../../src/model/integer-literal'
import { FieldReference } from '../../../src/model/field-reference'
import { DataDeclaration } from '../../../src/model/data-declaration'
import { DataLiteral } from '../../../src/model/data-literal'
import { IntegerValueSet, RCTypeValueSet } from '../../../src/model/value-set'

describe('Assignment', () => {
    it('outputs the correct CIR representation', () => {
        const context = newSemanticContext()
        context.scope.variables.set('x', {
            semantics: 'mut',
            valueSet: { type: 'integer' },
        })

        const assignment = Assignment.create({
            target: VariableReference.create({ name: 'x', span: someCodeSpan }),
            value: IntegerLiteral.create({ value: 42n, span: someCodeSpan }),
            span: someCodeSpan,
        })

        assignment.emitStatement(context)

        expect(context.scope.emitted).toMatchObject([
            {
                kind: 'ASSIGN',
                target: { kind: 'VARIABLE_REF', name: 'x' },
                value: { kind: 'INTEGER_LITERAL', value: '42' },
            },
        ])
    })

    describe('injects RELEASE/RETAIN statements', () => {
        test('for a FieldReference', () => {
            const context = newSemanticContext()
            context.scope.rootScope.declarations.set(
                'InnerType',
                DataDeclaration.create({
                    name: 'InnerType',
                    fields: [
                        {
                            name: 'innerField',
                            valueSet: IntegerValueSet.create({
                                span: someCodeSpan,
                            }),
                            semantics: 'mut',
                        },
                    ],
                }),
            )
            context.scope.rootScope.declarations.set(
                'OuterType',
                DataDeclaration.create({
                    name: 'OuterType',
                    fields: [
                        {
                            name: 'field',
                            valueSet: RCTypeValueSet.create({
                                typeName: 'InnerType',
                                span: someCodeSpan,
                            }),
                            semantics: 'mut',
                        },
                    ],
                }),
            )
            context.scope.variables.set('bar', {
                semantics: 'const',
                valueSet: {
                    type: 'rc-type',
                    semantics: 'COW',
                    typeName: 'OuterType',
                },
            })
            context.scope.variables.set('foo', {
                semantics: 'mut',
                valueSet: {
                    type: 'rc-type',
                    semantics: 'COW',
                    typeName: 'InnerType',
                },
            })

            const assignment = Assignment.create({
                target: VariableReference.create({
                    name: 'foo',
                    span: someCodeSpan,
                }),
                value: FieldReference.create({
                    object: VariableReference.create({
                        name: 'bar',
                        span: someCodeSpan,
                    }),
                    field: 'field',
                    operator: '.',
                    span: someCodeSpan,
                    fieldSpan: someCodeSpan,
                }),
                span: someCodeSpan,
            })

            assignment.emitStatement(context)
            expect(context.scope.emitted).toMatchObject([
                {
                    kind: 'VARIABLE_DECL',
                    name: '__tempˇ0',
                    valueSet: {
                        type: 'rc-type',
                        typeName: 'InnerType',
                        semantics: 'COW',
                    },
                    initialValue: {
                        kind: 'VARIABLE_REF',
                        name: 'foo',
                    },
                },
                {
                    kind: 'ASSIGN',
                    target: { kind: 'VARIABLE_REF', name: 'foo' },
                    value: {
                        kind: 'RETAIN',
                        object: {
                            kind: 'FIELD_REF',
                            object: { kind: 'VARIABLE_REF', name: 'bar' },
                            field: 'field',
                        },
                    },
                },
                {
                    kind: 'RELEASE',
                    object: {
                        kind: 'VARIABLE_REF',
                        name: '__tempˇ0',
                    },
                },
            ])
        })

        test('for a VariableReference', () => {
            const context = newSemanticContext()
            context.scope.rootScope.declarations.set(
                'MyType',
                DataDeclaration.create({
                    name: 'MyType',
                    fields: [
                        {
                            name: 'field',
                            valueSet: IntegerValueSet.create({
                                span: someCodeSpan,
                            }),
                            semantics: 'mut',
                        },
                    ],
                }),
            )
            context.scope.variables.set('bar', {
                semantics: 'const',
                valueSet: {
                    type: 'rc-type',
                    semantics: 'COW',
                    typeName: 'MyType',
                },
            })
            context.scope.variables.set('foo', {
                semantics: 'mut',
                valueSet: {
                    type: 'rc-type',
                    semantics: 'COW',
                    typeName: 'MyType',
                },
            })

            const assignment = Assignment.create({
                target: VariableReference.create({
                    name: 'foo',
                    span: someCodeSpan,
                }),
                value: VariableReference.create({
                    name: 'bar',
                    span: someCodeSpan,
                }),
                span: someCodeSpan,
            })

            assignment.emitStatement(context)
            expect(context.scope.emitted).toMatchObject([
                {
                    kind: 'VARIABLE_DECL',
                    name: '__tempˇ0',
                    valueSet: {
                        type: 'rc-type',
                        typeName: 'MyType',
                        semantics: 'COW',
                    },
                    initialValue: {
                        kind: 'VARIABLE_REF',
                        name: 'foo',
                    },
                },
                {
                    kind: 'ASSIGN',
                    target: { kind: 'VARIABLE_REF', name: 'foo' },
                    value: {
                        kind: 'RETAIN',
                        object: {
                            kind: 'VARIABLE_REF',
                            name: 'bar',
                        },
                    },
                },
                {
                    kind: 'RELEASE',
                    object: {
                        kind: 'VARIABLE_REF',
                        name: '__tempˇ0',
                    },
                },
            ])
        })
    })

    it('injects ENSURE_UNIQUE for COW target before assignment', () => {
        const context = newSemanticContext()
        context.scope.rootScope.declarations.set(
            'MyType',
            DataDeclaration.create({
                name: 'MyType',
                fields: [
                    {
                        name: 'field',
                        valueSet: IntegerValueSet.create({
                            span: someCodeSpan,
                        }),
                        semantics: 'mut',
                    },
                ],
            }),
        )
        context.scope.variables.set('foo', {
            semantics: 'mut',
            valueSet: {
                type: 'rc-type',
                semantics: 'COW',
                typeName: 'MyType',
            },
        })

        const assignment = Assignment.create({
            target: FieldReference.create({
                object: VariableReference.create({
                    name: 'foo',
                    span: someCodeSpan,
                }),
                field: 'field',
                operator: '.',
                span: someCodeSpan,
                fieldSpan: someCodeSpan,
            }),
            value: IntegerLiteral.create({ value: 42n, span: someCodeSpan }),
            span: someCodeSpan,
        })

        assignment.emitStatement(context)
        expect(context.scope.emitted).toMatchObject([
            {
                kind: 'ENSURE_UNIQUE',
                object: { kind: 'VARIABLE_REF', name: 'foo' },
            },
            {
                kind: 'ASSIGN',
                target: { object: { name: 'foo' } },
            },
        ])
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
            value: IntegerLiteral.create({ value: 42n, span: someCodeSpan }),
            span: someCodeSpan,
        })
        const context = newSemanticContext()
        expect(() => assignment.emitStatement(context)).toThrow()
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
        for (const [kind, semantics] of [
            ['const', 'COW'],
            ['ref', 'REF'],
        ] as const) {
            test(kind, () => {
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
                context.scope.variables.set('target', {
                    semantics: kind,
                    valueSet: {
                        type: 'rc-type',
                        semantics: semantics,
                        typeName: 'MyType',
                    },
                })
                context.scope.variables.set('value', {
                    semantics: kind,
                    valueSet: {
                        type: 'rc-type',
                        semantics: semantics,
                        typeName: 'MyType',
                    },
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
                expect(() => assignment.emitStatement(context)).toThrow()
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
        context.scope.variables.set('x', {
            semantics: 'const',
            valueSet: {
                type: 'rc-type',
                semantics: 'COW',
                typeName: 'MyType',
            },
        })

        const assignment = Assignment.create({
            target: FieldReference.create({
                object: VariableReference.create({
                    name: 'x',
                    span: someCodeSpan,
                }),
                operator: '.',
                field: 'myField',
                span: {
                    start: { line: 1, column: 3 },
                    end: { line: 1, column: 4 },
                },
                fieldSpan: someCodeSpan,
            }),
            value: IntegerLiteral.create({ value: 42n, span: someCodeSpan }),
            span: someCodeSpan,
        })
        expect(() => assignment.emitStatement(context)).toThrow()
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
                context.scope.variables.set('target', {
                    semantics: targetSemantics[0],
                    valueSet: {
                        type: 'rc-type',
                        semantics: targetSemantics[1],
                        typeName: 'MyType',
                    },
                })
                context.scope.variables.set('value', {
                    semantics: valueSemantics[0],
                    valueSet: {
                        type: 'rc-type',
                        semantics: valueSemantics[1],
                        typeName: 'MyType',
                    },
                })

                const assignment = Assignment.create({
                    target: VariableReference.create({
                        name: 'target',
                        span: someCodeSpan,
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
                expect(() => assignment.emitStatement(context)).toThrow()
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

        it('does not throw if the value is UNIQUE', () => {
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
            context.scope.variables.set('target', {
                semantics: 'mut',
                valueSet: {
                    type: 'rc-type',
                    semantics: 'COW',
                    typeName: 'MyType',
                },
            })

            const assignment = Assignment.create({
                target: VariableReference.create({
                    name: 'target',
                    span: someCodeSpan,
                }),
                span: someCodeSpan,
                value: DataLiteral.create({
                    fields: [
                        {
                            name: 'myField',
                            value: IntegerLiteral.create({
                                value: 42n,
                                span: someCodeSpan,
                            }),
                        },
                    ],
                    span: someCodeSpan,
                }),
            })
            expect(() => assignment.emitStatement(context)).not.toThrow()
        })
    })
})
