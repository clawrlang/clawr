import { describe, expect, it, test } from 'bun:test'
import { IntegerLiteral } from '../../../src/model/integer-literal'
import { VariableDeclaration } from '../../../src/model/variable-declaration'
import {
    ExplicitIntegerValueSet,
    ExplicitRCTypeValueSet,
    ExplicitTruthValueSet,
} from '../../../src/model/explicit-value-set'
import { newSemanticContext, someCodeSpan } from '../../util'
import { DataDeclaration } from '../../../src/model/data-declaration'
import { VariableReference } from '../../../src/model/variable-reference'
import { DataLiteral } from '../../../src/model/data-literal'
import { FieldReference } from '../../../src/model/field-reference'
import { TruthValueLiteral } from '../../../src/model/truthvalue-literal'
import { RCTypeLattice, IntegerLattice } from '../../../src/model/lattice'
import { TypeName } from '../../../src/model/type-name'
import { Query } from '../../../src/model/query'

describe('VariableDeclaration', () => {
    it('converts to CIR VARIABLE_DECL', () => {
        const decl = VariableDeclaration.create({
            isImmutable: true,
            isolationLevel: 'ISOLATED',
            name: 'foo',
            valueSet: ExplicitIntegerValueSet.create({
                span: someCodeSpan,
            }),
            initialValue: IntegerLiteral.create({
                value: 1n,
                span: someCodeSpan,
            }),
        })
        const context = newSemanticContext()
        decl.emitStatement(context)
        expect(context.scope.emitted[0]).toMatchObject({
            kind: 'VARIABLE_DECL',
            name: 'foo',
            valueSet: { type: 'integer', min: '1', max: '1' },
            initialValue: {
                kind: 'INTEGER_LITERAL',
                value: '1',
            },
        })
    })

    describe('inferred type', () => {
        it('infers narrowest value set for constant integer', () => {
            const decl = VariableDeclaration.create({
                isImmutable: true,
                isolationLevel: 'ISOLATED',
                name: 'foo',
                valueSet: undefined,
                initialValue: IntegerLiteral.create({
                    value: 1n,
                    span: someCodeSpan,
                }),
            })
            const context = newSemanticContext()
            decl.emitStatement(context)
            expect((context.scope.emitted[0] as any).valueSet).toEqual({
                type: 'integer',
                min: '1',
                max: '1',
            })
        })

        it('infers widest value set for mutable integer', () => {
            const decl = VariableDeclaration.create({
                isImmutable: false,
                isolationLevel: 'ISOLATED',
                name: 'foo',
                valueSet: undefined,
                initialValue: IntegerLiteral.create({
                    value: 1n,
                    span: someCodeSpan,
                }),
            })
            const context = newSemanticContext()
            context.scope.rootScope.addDataDeclaration(
                TypeName.create({ name: 'MyType' }),
                DataDeclaration.create({
                    name: TypeName.create({ name: 'MyType' }),
                    fields: [
                        {
                            name: 'field',
                            isImmutable: false,
                            isolationLevel: 'ISOLATED',
                            valueSet: ExplicitIntegerValueSet.create({
                                span: someCodeSpan,
                            }),
                        },
                    ],
                }),
            )
            decl.emitStatement(context)
            expect((context.scope.emitted[0] as any).valueSet).toEqual({
                type: 'integer',
            })
        })

        it('infers narrowest value set for constant truthvalue', () => {
            const decl = VariableDeclaration.create({
                isImmutable: true,
                isolationLevel: 'ISOLATED',
                name: 'foo',
                valueSet: undefined,
                initialValue: TruthValueLiteral.create({
                    value: 'true',
                    span: someCodeSpan,
                }),
            })
            const context = newSemanticContext()
            decl.emitStatement(context)
            expect((context.scope.emitted[0] as any).valueSet).toEqual({
                type: 'truthvalue',
                values: ['true'],
            })
        })

        it('infers widest value set for mutable truthvalue', () => {
            const decl = VariableDeclaration.create({
                isImmutable: false,
                isolationLevel: 'ISOLATED',
                name: 'foo',
                valueSet: undefined,
                initialValue: TruthValueLiteral.create({
                    value: 'true',
                    span: someCodeSpan,
                }),
            })
            const context = newSemanticContext()
            context.scope.rootScope.addDataDeclaration(
                TypeName.create({ name: 'MyType' }),
                DataDeclaration.create({
                    name: TypeName.create({ name: 'MyType' }),
                    fields: [
                        {
                            name: 'field',
                            isImmutable: false,
                            isolationLevel: 'ISOLATED',
                            valueSet: ExplicitTruthValueSet.create({
                                span: someCodeSpan,
                            }),
                        },
                    ],
                }),
            )
            decl.emitStatement(context)
            expect((context.scope.emitted[0] as any).valueSet).toEqual({
                type: 'truthvalue',
                values: ['false', 'ambiguous', 'true'],
            })
        })
    })

    describe('injects RETAIN statement', () => {
        test('for a FieldReference', () => {
            const context = newSemanticContext()
            context.scope.rootScope.addDataDeclaration(
                TypeName.create({ name: 'InnerType' }),
                DataDeclaration.create({
                    name: TypeName.create({ name: 'InnerType' }),
                    fields: [
                        {
                            name: 'innerField',
                            isImmutable: false,
                            isolationLevel: 'ISOLATED',
                            valueSet: ExplicitIntegerValueSet.create({
                                span: someCodeSpan,
                            }),
                        },
                    ],
                }),
            )
            context.scope.rootScope.addDataDeclaration(
                TypeName.create({ name: 'OuterType' }),
                DataDeclaration.create({
                    name: TypeName.create({ name: 'OuterType' }),
                    fields: [
                        {
                            name: 'field',
                            isImmutable: false,
                            isolationLevel: 'ISOLATED',
                            valueSet: ExplicitRCTypeValueSet.create({
                                type: TypeName.create({ name: 'InnerType' }),
                                span: someCodeSpan,
                            }),
                        },
                    ],
                }),
            )
            context.scope.variables.set('bar', {
                isImmutable: true,
                isolationLevel: 'ISOLATED',
                lattice: RCTypeLattice.create({
                    type: TypeName.create({ name: 'OuterType' }),
                }),
            })
            context.scope.setCurrentValue(
                'bar',
                RCTypeLattice.create({
                    type: TypeName.create({ name: 'OuterType' }),
                    fields: {
                        field: RCTypeLattice.create({
                            type: TypeName.create({ name: 'InnerType' }),
                            fields: {
                                innerField: IntegerLattice.create({
                                    min: 42n,
                                    max: 42n,
                                }),
                            },
                        }),
                    },
                }),
            )

            const decl = VariableDeclaration.create({
                isImmutable: false,
                isolationLevel: 'ISOLATED',
                name: 'foo',
                valueSet: ExplicitRCTypeValueSet.create({
                    type: TypeName.create({ name: 'InnerType' }),
                    span: someCodeSpan,
                }),
                initialValue: FieldReference.create({
                    object: VariableReference.create({
                        name: 'bar',
                        span: someCodeSpan,
                    }),
                    field: 'field',
                    operator: '.',
                    span: someCodeSpan,
                    fieldSpan: someCodeSpan,
                }),
            })
            decl.emitStatement(context)
            expect(context.scope.emitted[0]).toMatchObject({
                initialValue: {
                    kind: 'RETAIN',
                    object: {
                        kind: 'FIELD_REF',
                        object: {
                            kind: 'VARIABLE_REF',
                            name: 'bar',
                        },
                        field: 'field',
                    },
                },
            })
        })

        test('for a VariableReference', () => {
            const context = newSemanticContext()
            context.scope.rootScope.addDataDeclaration(
                TypeName.create({ name: 'MyType' }),
                DataDeclaration.create({
                    name: TypeName.create({ name: 'MyType' }),
                    fields: [
                        {
                            name: 'field',
                            isImmutable: false,
                            isolationLevel: 'ISOLATED',
                            valueSet: ExplicitIntegerValueSet.create({
                                span: someCodeSpan,
                            }),
                        },
                    ],
                }),
            )
            context.scope.variables.set('bar', {
                isImmutable: true,
                isolationLevel: 'ISOLATED',
                lattice: RCTypeLattice.create({
                    type: TypeName.create({ name: 'MyType' }),
                }),
            })
            context.scope.setCurrentValue(
                'bar',
                RCTypeLattice.create({
                    type: TypeName.create({ name: 'MyType' }),
                    fields: {
                        field: IntegerLattice.create({
                            min: 42n,
                            max: 42n,
                        }),
                    },
                }),
            )

            const decl = VariableDeclaration.create({
                isImmutable: false,
                isolationLevel: 'ISOLATED',
                name: 'foo',
                valueSet: ExplicitRCTypeValueSet.create({
                    type: TypeName.create({ name: 'MyType' }),
                    span: someCodeSpan,
                }),
                initialValue: VariableReference.create({
                    name: 'bar',
                    span: someCodeSpan,
                }),
            })
            decl.emitStatement(context)
            expect(context.scope.emitted[0]).toMatchObject({
                initialValue: {
                    kind: 'RETAIN',
                    object: {
                        kind: 'VARIABLE_REF',
                        name: 'bar',
                    },
                },
            })
        })
    })

    describe('registers its value in the context', () => {
        test('for a simple integer variable', () => {
            const decl = VariableDeclaration.create({
                isImmutable: true,
                isolationLevel: 'ISOLATED',
                name: 'x',
                valueSet: ExplicitIntegerValueSet.create({
                    span: someCodeSpan,
                }),
                initialValue: IntegerLiteral.create({
                    value: 42n,
                    span: someCodeSpan,
                }),
            })
            const context = newSemanticContext()
            decl.emitStatement(context)
            expect(context.scope.variableDeclaration('x')).toEqual({
                isImmutable: true,
                isolationLevel: 'ISOLATED',
                lattice: IntegerLattice.create({ min: 42n, max: 42n }),
            })
        })

        test('for a nested rc-type variable', () => {
            const context = newSemanticContext()
            context.scope.rootScope.addDataDeclaration(
                TypeName.create({ name: 'InnerType' }),
                DataDeclaration.create({
                    name: TypeName.create({ name: 'InnerType' }),
                    fields: [
                        {
                            isImmutable: false,
                            isolationLevel: 'ISOLATED',
                            name: 'innerField',
                            valueSet: ExplicitIntegerValueSet.create({
                                span: someCodeSpan,
                            }),
                        },
                    ],
                }),
            )
            context.scope.rootScope.addDataDeclaration(
                TypeName.create({ name: 'OuterType' }),
                DataDeclaration.create({
                    name: TypeName.create({ name: 'OuterType' }),
                    fields: [
                        {
                            name: 'field',
                            isImmutable: false,
                            isolationLevel: 'ISOLATED',
                            valueSet: ExplicitRCTypeValueSet.create({
                                type: TypeName.create({ name: 'InnerType' }),
                                span: someCodeSpan,
                            }),
                        },
                    ],
                }),
            )

            const declaration = VariableDeclaration.create({
                isImmutable: true,
                isolationLevel: 'ISOLATED',
                name: 'target',
                valueSet: ExplicitRCTypeValueSet.create({
                    type: TypeName.create({ name: 'OuterType' }),
                    span: someCodeSpan,
                }),
                initialValue: DataLiteral.create({
                    fields: [
                        {
                            name: 'field',
                            value: DataLiteral.create({
                                fields: [
                                    {
                                        name: 'innerField',
                                        value: IntegerLiteral.create({
                                            value: 42n,
                                            span: someCodeSpan,
                                        }),
                                    },
                                ],
                                span: someCodeSpan,
                            }),
                        },
                    ],
                    span: someCodeSpan,
                }),
            })

            declaration.emitStatement(context)

            expect(context.scope.currentValue('target')).toMatchObject({
                type: { name: 'OuterType' },
                fields: {
                    field: {
                        type: { name: 'InnerType' },
                        fields: {
                            innerField: {
                                min: 42n,
                                max: 42n,
                            },
                        },
                    },
                },
            })
        })

        it('converts UNIQUE expression to ISOLATED', () => {
            const context = newSemanticContext()
            context.scope.rootScope.addDataDeclaration(
                TypeName.create({ name: 'MyType' }),
                DataDeclaration.create({
                    name: TypeName.create({ name: 'MyType' }),
                    fields: [],
                }),
            )

            const decl = VariableDeclaration.create({
                isImmutable: true,
                isolationLevel: 'ISOLATED',
                name: 'foo',
                valueSet: ExplicitRCTypeValueSet.create({
                    type: TypeName.create({ name: 'MyType' }),
                    span: someCodeSpan,
                }),
                initialValue: DataLiteral.create({
                    fields: [],
                    span: someCodeSpan,
                }),
            })
            decl.emitStatement(context)
            expect(context.scope.currentValue('foo')).toBeInstanceOf(
                RCTypeLattice,
            )
        })

        it('converts UNIQUE expression to SHARED', () => {
            const context = newSemanticContext()
            context.scope.rootScope.addDataDeclaration(
                TypeName.create({ name: 'MyData' }),
                DataDeclaration.create({
                    name: TypeName.create({ name: 'MyData' }),
                    fields: [],
                }),
            )
            context.scope.variables.set('c', {
                isImmutable: true,
                isolationLevel: 'ISOLATED',
                lattice: RCTypeLattice.create({
                    type: TypeName.create({ name: 'MyData' }),
                }),
            })
            context.scope.setCurrentValue(
                'c',
                RCTypeLattice.create({
                    type: TypeName.create({ name: 'MyData' }),
                }),
            )

            const decl = VariableDeclaration.create({
                isImmutable: true,
                isolationLevel: 'SHARED',
                name: 'r',
                valueSet: ExplicitRCTypeValueSet.create({
                    type: TypeName.create({ name: 'MyData' }),
                    span: someCodeSpan,
                }),
                initialValue: Query.create({
                    baseName: 'copy',
                    arguments: [
                        {
                            label: 'of',
                            value: VariableReference.create({
                                name: 'c',
                                span: someCodeSpan,
                            }),
                        },
                    ],
                    span: someCodeSpan,
                }),
            })
            decl.emitStatement(context)
            expect(context.scope.currentValue('r')).toMatchObject({
                type: { name: 'MyData' },
            })
        })
    })

    describe('throws if the value has incompatible isolation-levels', () => {
        const cases = [true, false] as const

        cases.forEach((isImmutable) => {
            test(`mut target = SHARED value`, () => {
                const context = newSemanticContext()
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
                context.scope.variables.set('value', {
                    isImmutable,
                    isolationLevel: 'SHARED',
                    lattice: RCTypeLattice.create({
                        type: TypeName.create({ name: 'MyType' }),
                    }),
                })
                context.scope.setCurrentValue(
                    'value',
                    RCTypeLattice.create({
                        type: TypeName.create({ name: 'MyType' }),
                        fields: {
                            myField: IntegerLattice.create({
                                min: 42n,
                                max: 42n,
                            }),
                        },
                    }),
                )

                const declaration = VariableDeclaration.create({
                    isImmutable: false,
                    isolationLevel: 'ISOLATED',
                    name: 'target',
                    valueSet: ExplicitRCTypeValueSet.create({
                        type: TypeName.create({ name: 'MyType' }),
                        span: someCodeSpan,
                    }),
                    initialValue: VariableReference.create({
                        name: 'value',
                        span: {
                            start: { line: 1, column: 3 },
                            end: { line: 1, column: 4 },
                        },
                    }),
                })
                expect(() => declaration.emitStatement(context)).not.toThrow()
                expect(context.errorReporter).toMatchObject({
                    errors: [
                        {
                            message: `Cannot assign SHARED value to ISOLATED target`,
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
