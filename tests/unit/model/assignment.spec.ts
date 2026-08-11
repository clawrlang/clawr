import { describe, expect, it, test } from 'bun:test'
import { Assignment } from '../../../src/model/assignment'
import { newSemanticContext, someCodeSpan } from '../../util'
import { VariableReference } from '../../../src/model/variable-reference'
import { IntegerLiteral } from '../../../src/model/integer-literal'
import { FieldReference } from '../../../src/model/field-reference'
import { DataDeclaration } from '../../../src/model/data-declaration'
import {
    ExplicitIntegerValueSet,
    ExplicitRCTypeValueSet,
    ExplicitUniqueValueSet,
} from '../../../src/model/explicit-value-set'
import { FunctionDeclaration } from '../../../src/model/function-declaration'
import { Query } from '../../../src/model/query'
import { RCTypeLattice } from '../../../src/model/lattice'

describe('Assignment', () => {
    it('outputs the correct CIR representation', () => {
        const context = newSemanticContext()
        context.scope.variables.set('x', {
            isImmutable: false,
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
                            valueSet: ExplicitIntegerValueSet.create({
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
                            valueSet: ExplicitRCTypeValueSet.create({
                                typeName: 'InnerType',
                                semantics: 'mut',
                                span: someCodeSpan,
                            }),
                            semantics: 'mut',
                        },
                    ],
                }),
            )
            context.scope.variables.set('bar', {
                isImmutable: false,
                valueSet: {
                    type: 'rc-type',
                    semantics: 'ISOLATED',
                    typeName: 'OuterType',
                },
            })
            context.scope.variables.set('foo', {
                isImmutable: false,
                valueSet: {
                    type: 'rc-type',
                    semantics: 'ISOLATED',
                    typeName: 'InnerType',
                },
            })
            context.scope.setCurrentValue(
                'bar',
                RCTypeLattice.create({
                    typeName: 'OuterType',
                    semantics: 'ISOLATED',
                    fields: {
                        field: RCTypeLattice.create({
                            typeName: 'InnerType',
                            semantics: 'ISOLATED',
                            fields: {},
                        }),
                    },
                }),
            )

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
                        semantics: 'ISOLATED',
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
                    fields: [],
                }),
            )
            context.scope.variables.set('bar', {
                isImmutable: true,
                valueSet: {
                    type: 'rc-type',
                    semantics: 'ISOLATED',
                    typeName: 'MyType',
                },
            })
            context.scope.variables.set('foo', {
                isImmutable: false,
                valueSet: {
                    type: 'rc-type',
                    semantics: 'ISOLATED',
                    typeName: 'MyType',
                },
            })
            context.scope.setCurrentValue(
                'bar',
                RCTypeLattice.create({
                    typeName: 'MyType',
                    semantics: 'ISOLATED',
                    fields: {},
                }),
            )

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
                        semantics: 'ISOLATED',
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

    it('injects ENSURE_UNIQUE for ISOLATED target before assignment', () => {
        const context = newSemanticContext()
        context.scope.rootScope.declarations.set(
            'MyType',
            DataDeclaration.create({
                name: 'MyType',
                fields: [
                    {
                        name: 'field',
                        valueSet: ExplicitIntegerValueSet.create({
                            span: someCodeSpan,
                        }),
                        semantics: 'mut',
                    },
                ],
            }),
        )
        context.scope.variables.set('foo', {
            isImmutable: false,
            valueSet: {
                type: 'rc-type',
                semantics: 'ISOLATED',
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

    it('injects AS_SHARED for UNIQUE value before assignment to SHARED target', () => {
        const context = newSemanticContext()
        context.scope.rootScope.declarations.set(
            'MyType',
            DataDeclaration.create({
                name: 'MyType',
                fields: [],
            }),
        )
        context.scope.rootScope.declarations.set(
            'myFunction()',
            FunctionDeclaration.create({
                baseName: 'myFunction',
                result: ExplicitUniqueValueSet.create({
                    typeName: 'MyType',
                    span: someCodeSpan,
                }),
                parameters: [],
                implementation: {
                    kind: 'implicit-return',
                    expression: VariableReference.create({
                        name: 'mutVar',
                        span: someCodeSpan,
                    }),
                },
            }),
        )
        context.scope.rootScope.variables.set('refVar', {
            isImmutable: false,
            valueSet: {
                type: 'rc-type',
                semantics: 'SHARED',
                typeName: 'MyType',
            },
        })
        context.scope.rootScope.variables.set('mutVar', {
            isImmutable: false,
            valueSet: {
                type: 'rc-type',
                semantics: 'ISOLATED',
                typeName: 'MyType',
            },
        })

        const assignment = Assignment.create({
            target: VariableReference.create({
                name: 'refVar',
                span: someCodeSpan,
            }),
            value: Query.create({
                baseName: 'myFunction',
                arguments: [],
                span: someCodeSpan,
            }),
            span: someCodeSpan,
        })

        assignment.emitStatement(context)
        expect(context.scope.emitted).toMatchObject([
            {
                kind: 'ASSIGN',
                target: { name: 'refVar' },
                value: {
                    kind: 'AS_SHARED',
                    object: {
                        kind: 'CALL',
                        name: {
                            baseName: 'myFunction',
                            labels: [],
                        },
                        arguments: [],
                        valueSet: {
                            type: 'rc-type',
                            semantics: 'ISOLATED',
                            typeName: 'MyType',
                        },
                    },
                    valueSet: {
                        type: 'rc-type',
                        semantics: 'SHARED',
                        typeName: 'MyType',
                    },
                },
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
        for (const semantics of ['ISOLATED', 'SHARED'] as const) {
            test(semantics, () => {
                const context = newSemanticContext()
                context.scope.rootScope.declarations.set(
                    'MyType',
                    DataDeclaration.create({
                        name: 'MyType',
                        fields: [],
                    }),
                )
                context.scope.variables.set('target', {
                    isImmutable: true,
                    valueSet: {
                        type: 'rc-type',
                        semantics: semantics,
                        typeName: 'MyType',
                    },
                })
                context.scope.variables.set('value', {
                    isImmutable: true,
                    valueSet: {
                        type: 'rc-type',
                        semantics: semantics,
                        typeName: 'MyType',
                    },
                })
                context.scope.setCurrentValue(
                    'value',
                    RCTypeLattice.create({
                        typeName: 'MyType',
                        semantics,
                        fields: {},
                    }),
                )

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
                expect(() => assignment.emitStatement(context)).not.toThrow()
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
                        valueSet: ExplicitIntegerValueSet.create({
                            span: someCodeSpan,
                        }),
                        semantics: 'mut',
                    },
                ],
            }),
        )
        context.scope.variables.set('x', {
            isImmutable: true,
            valueSet: {
                type: 'rc-type',
                semantics: 'ISOLATED',
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
        expect(() => assignment.emitStatement(context)).not.toThrow()
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
            {
                targetSemantics: ['mut', 'ISOLATED'],
                valueSemantics: ['ref', 'SHARED'],
            },
            {
                targetSemantics: ['mut', 'ISOLATED'],
                valueSemantics: ['mutref', 'SHARED'],
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
                                valueSet: ExplicitIntegerValueSet.create({
                                    span: someCodeSpan,
                                }),
                                semantics: 'mut',
                            },
                        ],
                    }),
                )
                context.scope.variables.set('target', {
                    isImmutable: false,
                    valueSet: {
                        type: 'rc-type',
                        semantics: targetSemantics[1],
                        typeName: 'MyType',
                    },
                })
                context.scope.variables.set('value', {
                    isImmutable: valueSemantics[0] === 'ref',
                    valueSet: {
                        type: 'rc-type',
                        semantics: valueSemantics[1],
                        typeName: 'MyType',
                    },
                })
                context.scope.setCurrentValue(
                    'value',
                    RCTypeLattice.create({
                        typeName: 'MyType',
                        semantics: 'SHARED',
                    }),
                )
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
                expect(() => assignment.emitStatement(context)).not.toThrow()
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
