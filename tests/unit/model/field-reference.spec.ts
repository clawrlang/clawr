import { describe, expect, it, test } from 'bun:test'
import { FieldReference } from '../../../src/model/field-reference'
import { VariableReference } from '../../../src/model/variable-reference'
import { newSemanticContext, someCodeSpan } from '../../util'
import { DataDeclaration } from '../../../src/model/data-declaration'
import {
    ExplicitIntegerValueSet,
    ExplicitRCTypeValueSet,
} from '../../../src/model/explicit-value-set'
import { TypeName } from '../../../src/model/type-name'
import { RCTypeLattice } from '../../../src/model/lattice'

describe('Field Reference', () => {
    it('infers its type from the context', () => {
        const context = newSemanticContext()
        context.scope.variables.set('myVar', {
            isImmutable: false,
            isolationLevel: 'ISOLATED',
            lattice: RCTypeLattice.create({
                type: TypeName.create({ name: 'MyType' }),
                semantics: 'ISOLATED',
            }),
        })
        context.scope.rootScope.addDataDeclaration(
            TypeName.create({ name: 'MyType' }),
            DataDeclaration.create({
                name: TypeName.create({ name: 'MyType' }),
                fields: [
                    {
                        name: 'myField',
                        isImmutable: false,
                        isolationLevel: 'ISOLATED',
                        valueSet: ExplicitIntegerValueSet.create({
                            span: someCodeSpan,
                        }),
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
        expect(fieldRef.declaredValueSet(context).value().toCIR().type).toBe(
            'integer',
        )
    })

    it('infers its isolation level from the context', () => {
        const context = newSemanticContext()
        context.scope.variables.set('myVar', {
            isImmutable: false,
            isolationLevel: 'ISOLATED',
            lattice: RCTypeLattice.create({
                type: TypeName.create({ name: 'MyType' }),
                semantics: 'ISOLATED',
            }),
        })
        context.scope.rootScope.addDataDeclaration(
            TypeName.create({ name: 'MyType' }),
            DataDeclaration.create({
                name: TypeName.create({ name: 'MyType' }),
                fields: [
                    {
                        isImmutable: true,
                        isolationLevel: 'SHARED',
                        name: 'myField',
                        valueSet: ExplicitRCTypeValueSet.create({
                            type: TypeName.create({ name: 'MyType' }),
                            semantics: 'ref',
                            span: someCodeSpan,
                        }),
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
        expect(fieldRef.isolationLevel(context)).toEqual('SHARED')
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
                    isImmutable: semantics === 'const' || semantics === 'ref',
                    isolationLevel:
                        semantics === 'ref' || semantics === 'mutref'
                            ? 'SHARED'
                            : 'ISOLATED',
                    lattice: RCTypeLattice.create({
                        type: TypeName.create({ name: 'MyType' }),
                        semantics: expectedSemantics,
                    }),
                })
                context.scope.rootScope.addDataDeclaration(
                    TypeName.create({ name: 'InnerType' }),
                    DataDeclaration.create({
                        name: TypeName.create({ name: 'InnerType' }),
                        fields: [],
                    }),
                )
                context.scope.rootScope.addDataDeclaration(
                    TypeName.create({ name: 'MyType' }),
                    DataDeclaration.create({
                        name: TypeName.create({ name: 'MyType' }),
                        fields: [
                            {
                                isImmutable:
                                    semantics === 'const' ||
                                    semantics === 'ref',
                                isolationLevel:
                                    semantics === 'ref' ||
                                    semantics === 'mutref'
                                        ? 'SHARED'
                                        : 'ISOLATED',
                                name: 'myField',
                                valueSet: ExplicitRCTypeValueSet.create({
                                    type: TypeName.create({
                                        name: 'InnerType',
                                    }),
                                    semantics,
                                    span: someCodeSpan,
                                }),
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
                expect(fieldRef.isolationLevel(context)).toEqual(
                    expectedSemantics,
                )
                expect(
                    fieldRef.declaredValueSet(context).value(),
                ).toMatchObject({
                    type: { name: 'InnerType' },
                    semantics: expectedSemantics,
                })
            })
    })

    it('throws if the field does not exist on the type', () => {
        const context = newSemanticContext()
        context.scope.variables.set('myVar', {
            isImmutable: false,
            isolationLevel: 'ISOLATED',
            lattice: RCTypeLattice.create({
                type: TypeName.create({ name: 'MyType' }),
                semantics: 'ISOLATED',
            }),
        })
        context.scope.rootScope.addDataDeclaration(
            TypeName.create({ name: 'MyType' }),
            DataDeclaration.create({
                name: TypeName.create({ name: 'MyType' }),
                fields: [
                    {
                        isImmutable: false,
                        isolationLevel: 'ISOLATED',
                        name: 'myField',
                        valueSet: ExplicitIntegerValueSet.create({
                            span: someCodeSpan,
                        }),
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
            { operator: '->', semantics: [true, 'ISOLATED'] },
            { operator: '->', semantics: [false, 'ISOLATED'] },
            { operator: '.', semantics: [true, 'SHARED'] },
            { operator: '.', semantics: [false, 'SHARED'] },
        ] as const

        for (const { operator, semantics } of cases) {
            test(`${semantics} with "${operator}"`, () => {
                const context = newSemanticContext()
                context.scope.variables.set('myVar', {
                    isImmutable: semantics[0],
                    isolationLevel: semantics[1],
                    lattice: RCTypeLattice.create({
                        type: TypeName.create({ name: 'MyType' }),
                        semantics: semantics[1],
                    }),
                })
                context.scope.rootScope.addDataDeclaration(
                    TypeName.create({ name: 'MyType' }),
                    DataDeclaration.create({
                        name: TypeName.create({ name: 'MyType' }),
                        fields: [
                            {
                                name: 'myField',
                                isImmutable: false,
                                isolationLevel: 'ISOLATED',
                                valueSet: ExplicitIntegerValueSet.create({
                                    span: someCodeSpan,
                                }),
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
            {
                semantics: ['const', true, 'ISOLATED'],
                isImmutable: true,
                isolationLevel: 'ISOLATED',
                expected: true,
            },
            {
                semantics: ['mut', false, 'ISOLATED'],
                isImmutable: false,
                isolationLevel: 'ISOLATED',
                expected: false,
            },
            {
                semantics: ['ref', true, 'SHARED'],
                isImmutable: true,
                isolationLevel: 'SHARED',
                expected: false,
            },
            {
                semantics: ['mutref', false, 'SHARED'],
                isImmutable: false,
                isolationLevel: 'SHARED',
                expected: false,
            },
        ] as const

        for (const {
            semantics,
            isImmutable,
            isolationLevel,
            expected,
        } of cases) {
            it(`returns ${expected} if the object is ${semantics}`, () => {
                const context = newSemanticContext()
                context.scope.variables.set('myVar', {
                    isImmutable,
                    isolationLevel,
                    lattice: RCTypeLattice.create({
                        type: TypeName.create({ name: 'MyType' }),
                        semantics: semantics[2],
                    }),
                })
                context.scope.rootScope.addDataDeclaration(
                    TypeName.create({ name: 'MyType' }),
                    DataDeclaration.create({
                        name: TypeName.create({ name: 'MyType' }),
                        fields: [
                            {
                                name: 'myField',
                                isImmutable,
                                isolationLevel,
                                valueSet: ExplicitIntegerValueSet.create({
                                    span: someCodeSpan,
                                }),
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
                isImmutable: true,
                isolationLevel: 'ISOLATED',
                lattice: RCTypeLattice.create({
                    type: TypeName.create({ name: 'MyType' }),
                    semantics: 'ISOLATED',
                }),
            })
            context.scope.rootScope.addDataDeclaration(
                TypeName.create({ name: 'MyType' }),
                DataDeclaration.create({
                    name: TypeName.create({ name: 'MyType' }),
                    fields: [
                        {
                            isImmutable: false,
                            isolationLevel: 'ISOLATED',
                            name: 'myField',
                            valueSet: ExplicitIntegerValueSet.create({
                                span: someCodeSpan,
                            }),
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
                isImmutable: false,
                isolationLevel: 'ISOLATED',
                lattice: RCTypeLattice.create({
                    type: TypeName.create({ name: 'MyType' }),
                    semantics: 'ISOLATED',
                }),
            })
            context.scope.rootScope.addDataDeclaration(
                TypeName.create({ name: 'MyType' }),
                DataDeclaration.create({
                    name: TypeName.create({ name: 'MyType' }),
                    fields: [
                        {
                            isImmutable: false,
                            isolationLevel: 'ISOLATED',
                            name: 'myField',
                            valueSet: ExplicitIntegerValueSet.create({
                                span: someCodeSpan,
                            }),
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
