import { describe, expect, it, test } from 'bun:test'
import { FieldReference } from '../../../src/model/field-reference'
import { VariableReference } from '../../../src/model/variable-reference'
import { newSemanticContext, someCodeSpan } from '../../util'
import { DataDeclaration } from '../../../src/model/data-declaration'
import {
    ExplicitIntegerValueSet,
    ExplicitRCTypeValueSet,
} from '../../../src/model/explicit-value-set'

describe('Field Reference', () => {
    it('infers its type from the context', () => {
        const context = newSemanticContext()
        context.scope.variables.set('myVar', {
            semantics: 'mut',
            valueSet: {
                type: 'rc-type',
                semantics: 'COW',
                typeName: 'MyType',
            },
        })
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

        const fieldRef = FieldReference.create({
            object: VariableReference.create({
                name: 'myVar',
                span: someCodeSpan,
            }),
            operator: '.',
            field: 'myField',
            span: someCodeSpan,
            fieldSpan: someCodeSpan,
        })
        expect(fieldRef.toCIRExpression(context).valueSet.type).toBe('integer')
    })

    it('infers its isolation level from the context', () => {
        const context = newSemanticContext()
        context.scope.variables.set('myVar', {
            semantics: 'mut',
            valueSet: {
                type: 'rc-type',
                semantics: 'COW',
                typeName: 'MyType',
            },
        })
        context.scope.rootScope.declarations.set(
            'MyType',
            DataDeclaration.create({
                name: 'MyType',
                fields: [
                    {
                        name: 'myField',
                        valueSet: ExplicitRCTypeValueSet.create({
                            typeName: 'MyType',
                            semantics: 'mut',
                            span: someCodeSpan,
                        }),
                        semantics: 'mut',
                    },
                ],
            }),
        )

        const fieldRef = FieldReference.create({
            object: VariableReference.create({
                name: 'myVar',
                span: someCodeSpan,
            }),
            operator: '.',
            field: 'myField',
            span: someCodeSpan,
            fieldSpan: someCodeSpan,
        })
        expect(fieldRef.toCIRExpression(context).valueSet).toMatchObject({
            semantics: 'COW',
        })
    })

    describe('infers its type and isolation level from the context', () => {
        const cases = [
            { semantics: 'const', expectedSemantics: 'COW' },
            { semantics: 'mut', expectedSemantics: 'COW' },
            { semantics: 'ref', expectedSemantics: 'REF' },
            { semantics: 'mutref', expectedSemantics: 'REF' },
        ] as const

        for (const { semantics, expectedSemantics } of cases)
            test(`${semantics} object`, () => {
                const context = newSemanticContext()
                context.scope.variables.set('myVar', {
                    semantics,
                    valueSet: {
                        type: 'rc-type',
                        semantics: expectedSemantics,
                        typeName: 'MyType',
                    },
                })
                context.scope.rootScope.declarations.set(
                    'MyType',
                    DataDeclaration.create({
                        name: 'MyType',
                        fields: [
                            {
                                name: 'myField',
                                valueSet: ExplicitRCTypeValueSet.create({
                                    typeName: 'MyType',
                                    semantics,
                                    span: someCodeSpan,
                                }),
                                semantics,
                            },
                        ],
                    }),
                )

                const fieldRef = FieldReference.create({
                    object: VariableReference.create({
                        name: 'myVar',
                        span: someCodeSpan,
                    }),
                    operator: expectedSemantics === 'REF' ? '->' : '.',
                    field: 'myField',
                    span: someCodeSpan,
                    fieldSpan: someCodeSpan,
                })
                expect(
                    fieldRef.toCIRExpression(context).valueSet,
                ).toMatchObject({
                    type: 'rc-type',
                    typeName: 'MyType',
                    semantics: expectedSemantics,
                })
            })
    })

    it('throws if the field does not exist on the type', () => {
        const context = newSemanticContext()
        context.scope.variables.set('myVar', {
            semantics: 'mut',
            valueSet: {
                type: 'rc-type',
                semantics: 'COW',
                typeName: 'MyType',
            },
        })
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

        const fieldRef = FieldReference.create({
            object: VariableReference.create({
                name: 'myVar',
                span: someCodeSpan,
            }),
            operator: '.',
            field: 'nonExistentField',
            span: someCodeSpan,
            fieldSpan: someCodeSpan,
        })
        expect(() => fieldRef.toCIRExpression(context)).toThrowError(
            /Field nonExistentField does not exist on type MyType/,
        )
    })

    describe('throws if the object semantics are not compatible with the operator', () => {
        const cases = [
            { operator: '->', semantics: ['const', 'COW'] },
            { operator: '->', semantics: ['mut', 'COW'] },
            { operator: '.', semantics: ['ref', 'REF'] },
            { operator: '.', semantics: ['mutref', 'REF'] },
        ] as const

        for (const { operator, semantics } of cases) {
            test(`${semantics} with "${operator}"`, () => {
                const context = newSemanticContext()
                context.scope.variables.set('myVar', {
                    semantics: semantics[0],
                    valueSet: {
                        type: 'rc-type',
                        semantics: semantics[1],
                        typeName: 'MyType',
                    },
                })
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

                const fieldRef = FieldReference.create({
                    object: VariableReference.create({
                        name: 'myVar',
                        span: someCodeSpan,
                    }),
                    operator,
                    field: 'myField',
                    span: {
                        start: { line: 1, column: 1 },
                        end: { line: 1, column: 10 },
                    },
                    fieldSpan: someCodeSpan,
                })
                expect(() => fieldRef.toCIRExpression(context)).toThrow()
                expect(context.errorReporter).toMatchObject({
                    errors: [
                        {
                            message: `Cannot access field myField of a ${semantics[1]} type object with "${operator}" operator`,
                            location: {
                                start: { line: 1, column: 1 },
                                end: { line: 1, column: 10 },
                            },
                        },
                    ],
                })
            })
        }
    })

    describe('effectively const', () => {
        const cases = [
            { semantics: ['const', 'COW'], expected: true },
            { semantics: ['mut', 'COW'], expected: false },
            { semantics: ['ref', 'REF'], expected: false },
            { semantics: ['mutref', 'REF'], expected: false },
        ] as const

        for (const { semantics, expected } of cases) {
            it(`returns ${expected} if the object is ${semantics}`, () => {
                const context = newSemanticContext()
                context.scope.variables.set('myVar', {
                    semantics: semantics[0],
                    valueSet: {
                        type: 'rc-type',
                        semantics: semantics[1],
                        typeName: 'MyType',
                    },
                })
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
                                semantics: semantics[0],
                            },
                        ],
                    }),
                )

                const fieldRef = FieldReference.create({
                    object: VariableReference.create({
                        name: 'myVar',
                        span: someCodeSpan,
                    }),
                    operator: '.',
                    field: 'myField',
                    span: someCodeSpan,
                    fieldSpan: someCodeSpan,
                })
                expect(fieldRef.isEffectivelyConst(context)).toBe(expected)
            })
        }

        it('returns true if the object is immutable', () => {
            const context = newSemanticContext()
            context.scope.variables.set('myVar', {
                semantics: 'const',
                valueSet: {
                    type: 'rc-type',
                    semantics: 'COW',
                    typeName: 'MyType',
                },
            })
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

            const fieldRef = FieldReference.create({
                object: VariableReference.create({
                    name: 'myVar',
                    span: someCodeSpan,
                }),
                operator: '.',
                field: 'myField',
                span: someCodeSpan,
                fieldSpan: someCodeSpan,
            })
            expect(fieldRef.isEffectivelyConst(context)).toBe(true)
        })

        it('returns false if the object is mutable', () => {
            const context = newSemanticContext()
            context.scope.variables.set('myVar', {
                semantics: 'mut',
                valueSet: {
                    type: 'rc-type',
                    semantics: 'COW',
                    typeName: 'MyType',
                },
            })
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

            const fieldRef = FieldReference.create({
                object: VariableReference.create({
                    name: 'myVar',
                    span: someCodeSpan,
                }),
                operator: '.',
                field: 'myField',
                span: someCodeSpan,
                fieldSpan: someCodeSpan,
            })
            expect(fieldRef.isEffectivelyConst(context)).toBe(false)
        })
    })
})
