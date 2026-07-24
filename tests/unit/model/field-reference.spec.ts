import { describe, expect, it, test } from 'bun:test'
import { FieldReference } from '../../../src/model/field-reference'
import { VariableReference } from '../../../src/model/variable-reference'
import { newSemanticContext, someCodeSpan } from '../../util'
import { TypeDeclaration } from '../../../src/model/type-declaration'
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
                semantics: 'ISOLATED',
                typeName: 'MyType',
            },
        })
        context.scope.rootScope.declarations.set(
            'MyType',
            TypeDeclaration.create({
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
        expect(fieldRef.toCIRExpression(context).value().valueSet.type).toBe(
            'integer',
        )
    })

    it('infers its isolation level from the context', () => {
        const context = newSemanticContext()
        context.scope.variables.set('myVar', {
            semantics: 'mut',
            valueSet: {
                type: 'rc-type',
                semantics: 'ISOLATED',
                typeName: 'MyType',
            },
        })
        context.scope.rootScope.declarations.set(
            'MyType',
            TypeDeclaration.create({
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
        expect(
            fieldRef.toCIRExpression(context).value().valueSet,
        ).toMatchObject({
            semantics: 'ISOLATED',
        })
    })

    describe('infers its type and isolation level from the context', () => {
        const cases = [
            { semantics: 'const', expectedSemantics: 'ISOLATED' },
            { semantics: 'mut', expectedSemantics: 'ISOLATED' },
            { semantics: 'ref', expectedSemantics: 'SHARED' },
            { semantics: 'mutref', expectedSemantics: 'SHARED' },
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
                    TypeDeclaration.create({
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
                    operator: expectedSemantics === 'SHARED' ? '->' : '.',
                    field: 'myField',
                    span: someCodeSpan,
                    fieldSpan: someCodeSpan,
                })
                expect(
                    fieldRef.toCIRExpression(context).value().valueSet,
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
                semantics: 'ISOLATED',
                typeName: 'MyType',
            },
        })
        context.scope.rootScope.declarations.set(
            'MyType',
            TypeDeclaration.create({
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
        expect(fieldRef.toCIRExpression(context).getError().message).toMatch(
            /Field nonExistentField does not exist on type MyType/,
        )
    })

    describe('throws if the object semantics are not compatible with the operator', () => {
        const cases = [
            { operator: '->', semantics: ['const', 'ISOLATED'] },
            { operator: '->', semantics: ['mut', 'ISOLATED'] },
            { operator: '.', semantics: ['ref', 'SHARED'] },
            { operator: '.', semantics: ['mutref', 'SHARED'] },
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
                    TypeDeclaration.create({
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
                const result = fieldRef.toCIRExpression(context)
                expect(result.isFailure()).toBeTrue()
                expect(result.getError().errors[0]).toMatchObject({
                    message: `Cannot access field myField of a ${semantics[1]} type object with "${operator}" operator`,
                    span: {
                        start: { line: 1, column: 1 },
                        end: { line: 1, column: 10 },
                    },
                })
            })
        }
    })

    describe('effectively const', () => {
        const cases = [
            { semantics: ['const', 'ISOLATED'], expected: true },
            { semantics: ['mut', 'ISOLATED'], expected: false },
            { semantics: ['ref', 'SHARED'], expected: false },
            { semantics: ['mutref', 'SHARED'], expected: false },
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
                    TypeDeclaration.create({
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
                expect(fieldRef.isEffectivelyConst(context).value()).toBe(
                    expected,
                )
            })
        }

        it('returns true if the object is immutable', () => {
            const context = newSemanticContext()
            context.scope.variables.set('myVar', {
                semantics: 'const',
                valueSet: {
                    type: 'rc-type',
                    semantics: 'ISOLATED',
                    typeName: 'MyType',
                },
            })
            context.scope.rootScope.declarations.set(
                'MyType',
                TypeDeclaration.create({
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
            expect(fieldRef.isEffectivelyConst(context).value()).toBe(true)
        })

        it('returns false if the object is mutable', () => {
            const context = newSemanticContext()
            context.scope.variables.set('myVar', {
                semantics: 'mut',
                valueSet: {
                    type: 'rc-type',
                    semantics: 'ISOLATED',
                    typeName: 'MyType',
                },
            })
            context.scope.rootScope.declarations.set(
                'MyType',
                TypeDeclaration.create({
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
            expect(fieldRef.isEffectivelyConst(context).value()).toBe(false)
        })
    })
})
