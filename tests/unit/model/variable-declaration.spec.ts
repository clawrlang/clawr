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
import { CowTypeLattice, IntegerLattice } from '../../../src/model/lattice'

describe('VariableDeclaration', () => {
    it('converts to CIR VARIABLE_DECL', () => {
        const decl = VariableDeclaration.create({
            semantics: 'const',
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
        expect(context.scope.emitted[0]).toEqual({
            kind: 'VARIABLE_DECL',
            name: 'foo',
            valueSet: { type: 'integer', min: '1', max: '1' },
            initialValue: {
                kind: 'INTEGER_LITERAL',
                value: '1',
                valueSet: { type: 'integer', min: '1', max: '1' },
            },
        })
    })

    describe('inferred type', () => {
        it('infers narrowest value set for constant integer', () => {
            const decl = VariableDeclaration.create({
                semantics: 'const',
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
                semantics: 'mut',
                name: 'foo',
                valueSet: undefined,
                initialValue: IntegerLiteral.create({
                    value: 1n,
                    span: someCodeSpan,
                }),
            })
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
            decl.emitStatement(context)
            expect((context.scope.emitted[0] as any).valueSet).toEqual({
                type: 'integer',
            })
        })

        it('infers narrowest value set for constant truthvalue', () => {
            const decl = VariableDeclaration.create({
                semantics: 'const',
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
                semantics: 'mut',
                name: 'foo',
                valueSet: undefined,
                initialValue: TruthValueLiteral.create({
                    value: 'true',
                    span: someCodeSpan,
                }),
            })
            const context = newSemanticContext()
            context.scope.rootScope.declarations.set(
                'MyType',
                DataDeclaration.create({
                    name: 'MyType',
                    fields: [
                        {
                            name: 'field',
                            valueSet: ExplicitTruthValueSet.create({
                                span: someCodeSpan,
                            }),
                            semantics: 'mut',
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
                semantics: 'const',
                valueSet: {
                    type: 'rc-type',
                    semantics: 'COW',
                    typeName: 'OuterType',
                },
            })
            context.scope.setCurrentValue(
                'bar',
                CowTypeLattice.create({
                    typeName: 'OuterType',
                    fields: {
                        field: CowTypeLattice.create({
                            typeName: 'InnerType',
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
                semantics: 'mut',
                name: 'foo',
                valueSet: ExplicitRCTypeValueSet.create({
                    typeName: 'InnerType',
                    semantics: 'mut',
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
            context.scope.variables.set('bar', {
                semantics: 'const',
                valueSet: {
                    type: 'rc-type',
                    semantics: 'COW',
                    typeName: 'MyType',
                },
            })
            context.scope.setCurrentValue(
                'bar',
                CowTypeLattice.create({
                    typeName: 'MyType',
                    fields: {
                        field: IntegerLattice.create({
                            min: 42n,
                            max: 42n,
                        }),
                    },
                }),
            )

            const decl = VariableDeclaration.create({
                semantics: 'mut',
                name: 'foo',
                valueSet: ExplicitRCTypeValueSet.create({
                    typeName: 'MyType',
                    semantics: 'mut',
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
                semantics: 'const',
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
                semantics: 'const',
                valueSet: { type: 'integer', min: '42', max: '42' },
            })
        })

        test('for a nested rc-type variable', () => {
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

            const declaration = VariableDeclaration.create({
                semantics: 'const',
                name: 'target',
                valueSet: ExplicitRCTypeValueSet.create({
                    typeName: 'OuterType',
                    semantics: 'mut',
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
                typeName: 'OuterType',
                fields: {
                    field: {
                        typeName: 'InnerType',
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
    })

    describe('throws if the value has incompatible semantics', () => {
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
                                valueSet: ExplicitIntegerValueSet.create({
                                    span: someCodeSpan,
                                }),
                                semantics: 'mut',
                            },
                        ],
                    }),
                )
                context.scope.variables.set('value', {
                    semantics: valueSemantics[0],
                    valueSet: {
                        type: 'rc-type',
                        semantics: valueSemantics[1],
                        typeName: 'MyType',
                    },
                })
                context.scope.setCurrentValue(
                    'value',
                    CowTypeLattice.create({
                        typeName: 'MyType',
                        fields: {
                            myField: IntegerLattice.create({
                                min: 42n,
                                max: 42n,
                            }),
                        },
                    }),
                )

                const declaration = VariableDeclaration.create({
                    semantics: targetSemantics[0],
                    name: 'target',
                    valueSet: ExplicitRCTypeValueSet.create({
                        typeName: 'MyType',
                        semantics: targetSemantics[0],
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
                expect(() => declaration.emitStatement(context)).toThrow()
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
