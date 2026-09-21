import { DataDeclaration } from '@/model/data-declaration'
import { DataLiteral } from '@/model/data-literal'
import { decorateDomain } from '@/model/domain-declaration'
import { FieldReference } from '@/model/field-reference'
import { FunctionCall } from '@/model/function-call'
import { IntegerLiteral } from '@/model/integer-literal'
import { ISOLATED, SHARED } from '@/model/isolation-level'
import { TruthValueLiteral } from '@/model/truthvalue-literal'
import { TypeName } from '@/model/type-name'
import { IntegerRange, RCTypeSet, TruthvalueSet } from '@/model/value-set'
import { VariableDeclaration } from '@/model/variable-declaration'
import { VariableReference } from '@/model/variable-reference'
import { newSemanticContext, someCodeSpan } from '@@/util'
import { describe, expect, it, test } from 'bun:test'

describe('VariableDeclaration', () => {
    it('converts to CIR VARIABLE_DECL', () => {
        const decl = VariableDeclaration.create({
            isImmutable: true,
            name: 'foo',
            isolationLevel: ISOLATED,
            domain: decorateDomain(IntegerRange.unconstrained(), {
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
            domain: { type: 'integer', min: '1', max: '1' },
            initialValue: {
                kind: 'INTEGER_LITERAL',
                value: { type: 'integer', min: '1', max: '1' },
            },
        })
    })

    describe('inferred type', () => {
        it('infers narrowest value set for constant integer', () => {
            const decl = VariableDeclaration.create({
                isImmutable: true,
                name: 'foo',
                isolationLevel: ISOLATED,
                initialValue: IntegerLiteral.create({
                    value: 1n,
                    span: someCodeSpan,
                }),
            })
            const context = newSemanticContext()
            decl.emitStatement(context)
            expect((context.scope.emitted[0] as any).domain).toEqual({
                type: 'integer',
                min: '1',
                max: '1',
            })
        })

        it('infers widest value set for mutable integer', () => {
            const decl = VariableDeclaration.create({
                isImmutable: false,
                name: 'foo',
                isolationLevel: ISOLATED,
                initialValue: IntegerLiteral.create({
                    value: 1n,
                    span: someCodeSpan,
                }),
            })
            const context = newSemanticContext()
            context.scope.rootScope.addDataDeclaration(
                DataDeclaration.create({
                    name: TypeName.create({ name: 'MyType' }),
                    fields: [
                        {
                            name: 'field',
                            isImmutable: false,
                            isolationLevel: ISOLATED,
                            domain: decorateDomain(
                                IntegerRange.unconstrained(),
                                { span: someCodeSpan },
                            ),
                        },
                    ],
                }),
            )
            decl.emitStatement(context)
            expect((context.scope.emitted[0] as any).domain).toEqual({
                type: 'integer',
            })
        })

        it('infers narrowest value set for constant truthvalue', () => {
            const decl = VariableDeclaration.create({
                isImmutable: true,
                name: 'foo',
                isolationLevel: ISOLATED,
                initialValue: TruthValueLiteral.create({
                    value: 'true',
                    span: someCodeSpan,
                }),
            })
            const context = newSemanticContext()
            decl.emitStatement(context)
            expect((context.scope.emitted[0] as any).domain).toEqual({
                type: 'truthvalue',
                values: ['true'],
            })
        })

        it('infers widest value set for mutable truthvalue', () => {
            const decl = VariableDeclaration.create({
                isImmutable: false,
                name: 'foo',
                isolationLevel: ISOLATED,
                initialValue: TruthValueLiteral.create({
                    value: 'true',
                    span: someCodeSpan,
                }),
            })
            const context = newSemanticContext()
            context.scope.rootScope.addDataDeclaration(
                DataDeclaration.create({
                    name: TypeName.create({ name: 'MyType' }),
                    fields: [
                        {
                            name: 'field',
                            isImmutable: false,
                            isolationLevel: ISOLATED,
                            domain: decorateDomain(
                                TruthvalueSet.unconstrained(),
                                { span: someCodeSpan },
                            ),
                        },
                    ],
                }),
            )
            decl.emitStatement(context)
            expect((context.scope.emitted[0] as any).domain).toEqual({
                type: 'truthvalue',
                values: ['false', 'ambiguous', 'true'],
            })
        })
    })

    describe('injects RETAIN statement', () => {
        test('for a FieldReference', () => {
            const context = newSemanticContext()
            context.scope.rootScope.addDataDeclaration(
                DataDeclaration.create({
                    name: TypeName.create({ name: 'InnerType' }),
                    fields: [
                        {
                            name: 'innerField',
                            isImmutable: false,
                            isolationLevel: ISOLATED,
                            domain: decorateDomain(
                                IntegerRange.unconstrained(),
                                { span: someCodeSpan },
                            ),
                        },
                    ],
                }),
            )
            context.scope.rootScope.addDataDeclaration(
                DataDeclaration.create({
                    name: TypeName.create({ name: 'OuterType' }),
                    fields: [
                        {
                            name: 'field',
                            isImmutable: false,
                            isolationLevel: ISOLATED,
                            domain: decorateDomain(
                                RCTypeSet.create({
                                    type: TypeName.create({
                                        name: 'InnerType',
                                    }),
                                }),
                                { span: someCodeSpan },
                            ),
                        },
                    ],
                }),
            )
            context.scope.addVariableDeclaration('bar', {
                isImmutable: true,
                isolationLevel: ISOLATED,
                domain: RCTypeSet.create({
                    type: TypeName.create({ name: 'OuterType' }),
                }),
            })
            context.scope.setCurrentValue(
                'bar',
                RCTypeSet.create({
                    type: TypeName.create({ name: 'OuterType' }),
                    fields: {
                        field: RCTypeSet.create({
                            type: TypeName.create({ name: 'InnerType' }),
                            fields: {
                                innerField: IntegerRange.create({
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
                name: 'foo',
                isolationLevel: ISOLATED,
                domain: decorateDomain(
                    RCTypeSet.create({
                        type: TypeName.create({ name: 'InnerType' }),
                    }),
                    { span: someCodeSpan },
                ),
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
                DataDeclaration.create({
                    name: TypeName.create({ name: 'MyType' }),
                    fields: [
                        {
                            name: 'field',
                            isImmutable: false,
                            isolationLevel: ISOLATED,
                            domain: decorateDomain(
                                IntegerRange.unconstrained(),
                                { span: someCodeSpan },
                            ),
                        },
                    ],
                }),
            )
            context.scope.addVariableDeclaration('bar', {
                isImmutable: true,
                isolationLevel: ISOLATED,
                domain: RCTypeSet.create({
                    type: TypeName.create({ name: 'MyType' }),
                }),
            })
            context.scope.setCurrentValue(
                'bar',
                RCTypeSet.create({
                    type: TypeName.create({ name: 'MyType' }),
                    fields: {
                        field: IntegerRange.create({
                            min: 42n,
                            max: 42n,
                        }),
                    },
                }),
            )

            const decl = VariableDeclaration.create({
                isImmutable: false,
                name: 'foo',
                isolationLevel: ISOLATED,
                domain: decorateDomain(
                    RCTypeSet.create({
                        type: TypeName.create({ name: 'MyType' }),
                    }),
                    { span: someCodeSpan },
                ),
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

        test('but not for non-RC fields', () => {
            const context = newSemanticContext()
            context.scope.rootScope.addDataDeclaration(
                DataDeclaration.create({
                    name: TypeName.create({ name: 'MyType' }),
                    fields: [
                        {
                            name: 'field',
                            isImmutable: false,
                            isolationLevel: ISOLATED,
                            domain: decorateDomain(
                                IntegerRange.unconstrained(),
                                { span: someCodeSpan },
                            ),
                        },
                    ],
                }),
            )
            context.scope.addVariableDeclaration('bar', {
                isImmutable: true,
                isolationLevel: ISOLATED,
                domain: RCTypeSet.create({
                    type: TypeName.create({ name: 'MyType' }),
                }),
            })
            context.scope.setCurrentValue(
                'bar',
                RCTypeSet.create({
                    type: TypeName.create({ name: 'MyType' }),
                    fields: {
                        field: IntegerRange.create({
                            min: 42n,
                            max: 42n,
                        }),
                    },
                }),
            )

            const decl = VariableDeclaration.create({
                isImmutable: false,
                name: 'foo',
                isolationLevel: ISOLATED,
                domain: decorateDomain(IntegerRange.unconstrained(), {
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
                    kind: 'FIELD_REF',
                    object: {
                        kind: 'VARIABLE_REF',
                        name: 'bar',
                    },
                    field: 'field',
                },
            })
        })
    })

    describe('registers its value in the context', () => {
        test('for a simple integer variable', () => {
            const decl = VariableDeclaration.create({
                isImmutable: true,
                name: 'x',
                isolationLevel: ISOLATED,
                domain: decorateDomain(IntegerRange.unconstrained(), {
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
                isolationLevel: ISOLATED,
                domain: IntegerRange.create({ min: 42n, max: 42n }),
            })
        })

        test('for a nested rc-type variable', () => {
            const context = newSemanticContext()
            context.scope.rootScope.addDataDeclaration(
                DataDeclaration.create({
                    name: TypeName.create({ name: 'InnerType' }),
                    fields: [
                        {
                            isImmutable: false,
                            name: 'innerField',
                            isolationLevel: ISOLATED,
                            domain: decorateDomain(
                                IntegerRange.unconstrained(),
                                { span: someCodeSpan },
                            ),
                        },
                    ],
                }),
            )
            context.scope.rootScope.addDataDeclaration(
                DataDeclaration.create({
                    name: TypeName.create({ name: 'OuterType' }),
                    fields: [
                        {
                            name: 'field',
                            isImmutable: false,
                            isolationLevel: ISOLATED,
                            domain: decorateDomain(
                                RCTypeSet.create({
                                    type: TypeName.create({
                                        name: 'InnerType',
                                    }),
                                }),
                                { span: someCodeSpan },
                            ),
                        },
                    ],
                }),
            )

            const declaration = VariableDeclaration.create({
                isImmutable: true,
                name: 'target',
                isolationLevel: ISOLATED,
                domain: decorateDomain(
                    RCTypeSet.create({
                        type: TypeName.create({ name: 'OuterType' }),
                    }),
                    { span: someCodeSpan },
                ),
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
                DataDeclaration.create({
                    name: TypeName.create({ name: 'MyType' }),
                    fields: [],
                }),
            )

            const decl = VariableDeclaration.create({
                isImmutable: true,
                name: 'foo',
                isolationLevel: ISOLATED,
                domain: decorateDomain(
                    RCTypeSet.create({
                        type: TypeName.create({ name: 'MyType' }),
                    }),
                    { span: someCodeSpan },
                ),
                initialValue: DataLiteral.create({
                    fields: [],
                    span: someCodeSpan,
                }),
            })
            decl.emitStatement(context)
            expect(context.scope.currentValue('foo')).toBeInstanceOf(RCTypeSet)
        })

        it('converts UNIQUE expression to SHARED', () => {
            const context = newSemanticContext()
            context.scope.rootScope.addDataDeclaration(
                DataDeclaration.create({
                    name: TypeName.create({ name: 'MyData' }),
                    fields: [],
                }),
            )
            context.scope.addVariableDeclaration('c', {
                isImmutable: true,
                isolationLevel: ISOLATED,
                domain: RCTypeSet.create({
                    type: TypeName.create({ name: 'MyData' }),
                }),
            })

            const decl = VariableDeclaration.create({
                isImmutable: true,
                name: 'r',
                isolationLevel: SHARED,
                domain: decorateDomain(
                    RCTypeSet.create({
                        type: TypeName.create({ name: 'MyData' }),
                    }),
                    { span: someCodeSpan },
                ),
                initialValue: FunctionCall.create({
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
                    DataDeclaration.create({
                        name: TypeName.create({ name: 'MyType' }),
                        fields: [
                            {
                                name: 'myField',
                                isImmutable: false,
                                isolationLevel: ISOLATED,
                                domain: decorateDomain(
                                    IntegerRange.unconstrained(),
                                    { span: someCodeSpan },
                                ),
                            },
                        ],
                    }),
                )
                context.scope.addVariableDeclaration('value', {
                    isImmutable,
                    isolationLevel: SHARED,
                    domain: RCTypeSet.create({
                        type: TypeName.create({ name: 'MyType' }),
                    }),
                })
                context.scope.setCurrentValue(
                    'value',
                    RCTypeSet.create({
                        type: TypeName.create({ name: 'MyType' }),
                        fields: {
                            myField: IntegerRange.create({
                                min: 42n,
                                max: 42n,
                            }),
                        },
                    }),
                )

                const declaration = VariableDeclaration.create({
                    isImmutable: false,
                    name: 'target',
                    isolationLevel: ISOLATED,
                    domain: decorateDomain(
                        RCTypeSet.create({
                            type: TypeName.create({ name: 'MyType' }),
                        }),
                        { span: someCodeSpan },
                    ),
                    initialValue: VariableReference.create({
                        name: 'value',
                        span: {
                            start: { line: 1, column: 3 },
                            end: { line: 1, column: 4 },
                        },
                    }),
                })
                const result = declaration.emitStatement(context)
                expect(result.isError && result.error.errors).toMatchObject([
                    {
                        message: `Cannot assign SHARED value to ISOLATED target`,
                        span: {
                            start: { line: 1, column: 3 },
                            end: { line: 1, column: 4 },
                        },
                    },
                ])
            })
        })
    })
})
