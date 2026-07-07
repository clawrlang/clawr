import { describe, expect, it, test } from 'bun:test'
import { IntegerLiteral } from '../../../src/model/integer-literal'
import { VariableDeclaration } from '../../../src/model/variable-declaration'
import { newSemanticContext, someCodeSpan } from '../../util'
import { DataDeclaration } from '../../../src/model/data-declaration'
import { VariableReference } from '../../../src/model/variable-reference'
import { DataLiteral } from '../../../src/model/data-literal'
import { FieldReference } from '../../../src/model/field-reference'
import { TruthValueLiteral } from '../../../src/model/truthvalue-literal'

describe('VariableDeclaration', () => {
    it('converts to CIR VARIABLE_DECL', () => {
        const decl = VariableDeclaration.create({
            semantics: 'const',
            name: 'foo',
            type: 'integer',
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
            valueSet: { type: 'integer' },
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
                type: undefined,
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
                type: undefined,
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
                            type: 'integer',
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
                type: undefined,
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
                type: undefined,
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
                            type: 'truthvalue',
                            semantics: 'mut',
                        },
                    ],
                }),
            )
            decl.emitStatement(context)
            expect((context.scope.emitted[0] as any).valueSet).toEqual({
                type: 'truthvalue',
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
                            type: 'integer',
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
                            type: 'InnerType',
                            semantics: 'mut',
                        },
                    ],
                }),
            )
            context.scope.variables.set('bar', {
                semantics: 'const',
                allowedValues: {
                    type: 'rc-type',
                    semantics: 'COW',
                    typeName: 'OuterType',
                },
                currentValue: {
                    type: 'rc-type',
                    semantics: 'COW',
                    typeName: 'OuterType',
                },
            })

            const decl = VariableDeclaration.create({
                semantics: 'mut',
                name: 'foo',
                type: 'InnerType',
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
                            type: 'integer',
                            semantics: 'mut',
                        },
                    ],
                }),
            )
            context.scope.variables.set('bar', {
                semantics: 'const',
                allowedValues: {
                    type: 'rc-type',
                    semantics: 'COW',
                    typeName: 'MyType',
                },
                currentValue: {
                    type: 'rc-type',
                    semantics: 'COW',
                    typeName: 'MyType',
                },
            })

            const decl = VariableDeclaration.create({
                semantics: 'mut',
                name: 'foo',
                type: 'MyType',
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

    it('registers itself in the context', () => {
        const decl = VariableDeclaration.create({
            semantics: 'const',
            name: 'x',
            type: 'integer',
            initialValue: IntegerLiteral.create({
                value: 42n,
                span: someCodeSpan,
            }),
        })
        const context = newSemanticContext()
        decl.emitStatement(context)
        expect(context.scope.variableDeclaration('x')).toEqual({
            semantics: 'const',
            allowedValues: { type: 'integer', min: '42', max: '42' },
            currentValue: { type: 'integer', min: '42', max: '42' },
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
                                type: 'integer',
                                semantics: 'mut',
                            },
                        ],
                    }),
                )
                context.scope.variables.set('value', {
                    semantics: valueSemantics[0],
                    allowedValues: {
                        type: 'rc-type',
                        semantics: valueSemantics[1],
                        typeName: 'MyType',
                    },
                    currentValue: {
                        type: 'rc-type',
                        semantics: valueSemantics[1],
                        typeName: 'MyType',
                    },
                })

                const declaration = VariableDeclaration.create({
                    semantics: targetSemantics[0],
                    name: 'target',
                    type: 'MyType',
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

        it('does not throw if the value is UNIQUE', () => {
            const context = newSemanticContext()
            context.scope.rootScope.declarations.set(
                'MyType',
                DataDeclaration.create({
                    name: 'MyType',
                    fields: [
                        {
                            name: 'myField',
                            type: 'integer',
                            semantics: 'mut',
                        },
                    ],
                }),
            )

            const declaration = VariableDeclaration.create({
                semantics: 'const',
                name: 'target',
                type: 'MyType',
                initialValue: DataLiteral.create({
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
            expect(() => declaration.emitStatement(context)).not.toThrow()
        })
    })
})
