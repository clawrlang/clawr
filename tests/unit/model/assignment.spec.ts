import { describe, expect, it, test } from 'bun:test'
import { Assignment } from '@/model/assignment'
import { newSemanticContext, someCodeSpan } from '@@/util'
import { VariableReference } from '@/model/variable-reference'
import { IntegerLiteral } from '@/model/integer-literal'
import { FieldReference } from '@/model/field-reference'
import { DataDeclaration } from '@/model/data-declaration'
import { FunctionDeclaration } from '@/model/function-declaration'
import { Query } from '@/model/query'
import { IntegerLattice, RCTypeLattice } from '@/model/lattice'
import { TypeName } from '@/model/type-name'
import { ISOLATED, SHARED, UNIQUE, UNKNOWN } from '@/model/isolation-level'
import { decorateLattice } from '@/model/lattice-declaration'
import { Failable, isFailure } from '@/tools/failable'
import assert from 'assert'

describe('Assignment', () => {
    it('outputs the correct CIR representation', () => {
        const context = newSemanticContext()
        context.scope.variables.set('x', {
            isImmutable: false,
            isolationLevel: ISOLATED,
            lattice: IntegerLattice.unconstrained(),
        })
        context.scope.setCurrentValue('x', IntegerLattice.singleton(0n))

        const assignment = Assignment.create({
            target: VariableReference.create({ name: 'x', span: someCodeSpan }),
            value: IntegerLiteral.create({ value: 42n, span: someCodeSpan }),
            span: someCodeSpan,
        })

        Failable.do(() => assignment.emitStatement(context))

        expect(context.scope.emitted).toMatchObject([
            {
                kind: 'ASSIGN',
                target: { kind: 'VARIABLE_REF', name: 'x' },
                value: {
                    kind: 'INTEGER_LITERAL',
                    value: { min: '42', max: '42' },
                },
            },
        ])
    })

    describe('injects RELEASE/RETAIN statements', () => {
        test('for a FieldReference', () => {
            const context = newSemanticContext()
            context.scope.rootScope.addDataDeclaration(
                DataDeclaration.create({
                    name: TypeName.create({ name: 'InnerType' }),
                    fields: [
                        {
                            isImmutable: false,
                            name: 'innerField',
                            isolationLevel: ISOLATED,
                            lattice: decorateLattice(
                                IntegerLattice.unconstrained(),
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
                            isImmutable: false,
                            name: 'field',
                            isolationLevel: ISOLATED,
                            lattice: decorateLattice(
                                RCTypeLattice.create({
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
            context.scope.variables.set('bar', {
                isImmutable: false,
                isolationLevel: ISOLATED,
                lattice: RCTypeLattice.create({
                    type: TypeName.create({ name: 'OuterType' }),
                }),
            })
            context.scope.variables.set('foo', {
                isImmutable: false,
                isolationLevel: ISOLATED,
                lattice: RCTypeLattice.create({
                    type: TypeName.create({ name: 'InnerType' }),
                }),
            })
            context.scope.setCurrentValue(
                'foo',
                RCTypeLattice.create({
                    type: TypeName.create({ name: 'InnerType' }),
                }),
            )
            context.scope.setCurrentValue(
                'bar',
                RCTypeLattice.create({
                    type: TypeName.create({ name: 'OuterType' }),
                    fields: {
                        field: RCTypeLattice.create({
                            type: TypeName.create({ name: 'InnerType' }),
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

            Failable.do(() => assignment.emitStatement(context))
            expect(context.scope.emitted).toMatchObject([
                {
                    kind: 'VARIABLE_DECL',
                    name: '__tempˇ0',
                    lattice: {
                        type: 'rc-type',
                        name: 'InnerType',
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
            context.scope.rootScope.addDataDeclaration(
                DataDeclaration.create({
                    name: TypeName.create({ name: 'MyType' }),
                    fields: [],
                }),
            )
            context.scope.variables.set('bar', {
                isImmutable: true,
                isolationLevel: ISOLATED,
                lattice: RCTypeLattice.create({
                    type: TypeName.create({ name: 'MyType' }),
                }),
            })
            context.scope.variables.set('foo', {
                isImmutable: false,
                isolationLevel: ISOLATED,
                lattice: RCTypeLattice.create({
                    type: TypeName.create({ name: 'MyType' }),
                }),
            })
            context.scope.setCurrentValue(
                'bar',
                RCTypeLattice.create({
                    type: TypeName.create({ name: 'MyType' }),
                    fields: {},
                }),
            )
            context.scope.setCurrentValue(
                'foo',
                RCTypeLattice.create({
                    type: TypeName.create({ name: 'MyType' }),
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

            Failable.do(() => assignment.emitStatement(context))
            expect(context.scope.emitted).toMatchObject([
                {
                    kind: 'VARIABLE_DECL',
                    name: '__tempˇ0',
                    lattice: {
                        type: 'rc-type',
                        name: 'MyType',
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
        context.scope.rootScope.addDataDeclaration(
            DataDeclaration.create({
                name: TypeName.create({ name: 'MyType' }),
                fields: [
                    {
                        name: 'field',
                        isImmutable: false,
                        isolationLevel: ISOLATED,
                        lattice: decorateLattice(
                            IntegerLattice.unconstrained(),
                            { span: someCodeSpan },
                        ),
                    },
                ],
            }),
        )
        context.scope.variables.set('foo', {
            isImmutable: false,
            isolationLevel: ISOLATED,
            lattice: RCTypeLattice.create({
                type: TypeName.create({ name: 'MyType' }),
            }),
        })
        context.scope.setCurrentValue(
            'foo',
            RCTypeLattice.create({
                type: TypeName.create({ name: 'MyType' }),
            }),
        )

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

        Failable.do(() => assignment.emitStatement(context))
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
        context.scope.rootScope.addDataDeclaration(
            DataDeclaration.create({
                name: TypeName.create({ name: 'MyType' }),
                fields: [],
            }),
        )
        context.scope.rootScope.addFunctionDeclaration(
            FunctionDeclaration.create({
                baseName: 'myFunction',
                result: {
                    lattice: decorateLattice(
                        RCTypeLattice.create({
                            type: TypeName.create({ name: 'MyType' }),
                        }),
                        { span: someCodeSpan },
                    ),
                    isolationLevel: UNIQUE,
                },
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
            isolationLevel: SHARED,
            lattice: RCTypeLattice.create({
                type: TypeName.create({ name: 'MyType' }),
            }),
        })
        context.scope.rootScope.variables.set('mutVar', {
            isImmutable: false,
            isolationLevel: ISOLATED,
            lattice: RCTypeLattice.create({
                type: TypeName.create({ name: 'MyType' }),
            }),
        })
        context.scope.setCurrentValue(
            'refVar',
            RCTypeLattice.create({ type: TypeName.create({ name: 'MyType' }) }),
        )

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

        Failable.do(() => assignment.emitStatement(context))
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
        const result = Failable.do(() => assignment.emitStatement(context))
        assert(isFailure(result))
        expect(result.errors.map((e) => e.message)).toContain(
            'Variable x is not defined in the current context',
        )
    })

    describe('throws if the target variable is immutable/non-assignable', () => {
        for (const isolationLevel of [ISOLATED, SHARED] as const) {
            test(isolationLevel, () => {
                const context = newSemanticContext()
                context.scope.rootScope.addDataDeclaration(
                    DataDeclaration.create({
                        name: TypeName.create({ name: 'MyType' }),
                        fields: [],
                    }),
                )
                context.scope.variables.set('target', {
                    isImmutable: true,
                    isolationLevel: isolationLevel,
                    lattice: RCTypeLattice.create({
                        type: TypeName.create({ name: 'MyType' }),
                    }),
                })
                context.scope.variables.set('value', {
                    isImmutable: true,
                    isolationLevel: isolationLevel,
                    lattice: RCTypeLattice.create({
                        type: TypeName.create({ name: 'MyType' }),
                    }),
                })
                context.scope.setCurrentValue(
                    'target',
                    RCTypeLattice.create({
                        type: TypeName.create({ name: 'MyType' }),
                        fields: {},
                    }),
                )
                context.scope.setCurrentValue(
                    'value',
                    RCTypeLattice.create({
                        type: TypeName.create({ name: 'MyType' }),
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
                const result = Failable.do(() =>
                    assignment.emitStatement(context),
                )
                assert(isFailure(result))
                expect(result.errors).toMatchObject([
                    {
                        message: `Variable target is not mutable`,
                        span: {
                            start: { line: 1, column: 1 },
                            end: { line: 1, column: 2 },
                        },
                    },
                ])
            })
        }
    })

    it('throws if the target field is effectively const (ISOLATED)', () => {
        const context = newSemanticContext()
        context.scope.rootScope.addDataDeclaration(
            DataDeclaration.create({
                name: TypeName.create({ name: 'MyType' }),
                fields: [
                    {
                        name: 'myField',
                        isImmutable: false,
                        isolationLevel: ISOLATED,
                        lattice: decorateLattice(
                            IntegerLattice.unconstrained(),
                            { span: someCodeSpan },
                        ),
                    },
                ],
            }),
        )
        context.scope.variables.set('x', {
            isImmutable: true,
            isolationLevel: ISOLATED,
            lattice: RCTypeLattice.create({
                type: TypeName.create({ name: 'MyType' }),
            }),
        })
        context.scope.setCurrentValue(
            'x',
            RCTypeLattice.create({ type: TypeName.create({ name: 'MyType' }) }),
        )

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
        const result = Failable.do(() => assignment.emitStatement(context))

        assert(isFailure(result))
        expect(result.errors).toMatchObject([
            {
                message:
                    'Cannot mutate field myField of a reference type object',
                span: {
                    start: { line: 1, column: 3 },
                    end: { line: 1, column: 4 },
                },
            },
        ])
    })

    it('throws if the target field is effectively const (UNKNOWN isolation level)', () => {
        const context = newSemanticContext()
        context.scope.rootScope.addDataDeclaration(
            DataDeclaration.create({
                name: TypeName.create({ name: 'MyType' }),
                fields: [
                    {
                        name: 'myField',
                        isImmutable: false,
                        isolationLevel: ISOLATED,
                        lattice: decorateLattice(
                            IntegerLattice.unconstrained(),
                            { span: someCodeSpan },
                        ),
                    },
                ],
            }),
        )
        context.scope.variables.set('x', {
            isImmutable: true,
            isolationLevel: UNKNOWN,
            lattice: RCTypeLattice.create({
                type: TypeName.create({ name: 'MyType' }),
            }),
        })
        context.scope.setCurrentValue(
            'x',
            RCTypeLattice.create({ type: TypeName.create({ name: 'MyType' }) }),
        )

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

        const result = Failable.do(() => assignment.emitStatement(context))
        assert(isFailure(result))
        expect(result.errors).toMatchObject([
            {
                message:
                    'Cannot mutate field myField of a reference type object',
                span: {
                    start: { line: 1, column: 3 },
                    end: { line: 1, column: 4 },
                },
            },
        ])
    })

    describe('throws if the value and target have incompatible isolation-levels', () => {
        const cases = [
            { isImmutable: true, mutString: 'immutable' },
            { isImmutable: false, mutString: 'mutable' },
        ] as const

        cases.forEach(({ isImmutable, mutString }) => {
            test(`mut target = ${mutString} value`, () => {
                const context = newSemanticContext()
                context.scope.rootScope.addDataDeclaration(
                    DataDeclaration.create({
                        name: TypeName.create({ name: 'MyType' }),
                        fields: [
                            {
                                name: 'myField',
                                isImmutable: false,
                                isolationLevel: ISOLATED,
                                lattice: decorateLattice(
                                    IntegerLattice.unconstrained(),
                                    { span: someCodeSpan },
                                ),
                            },
                        ],
                    }),
                )
                context.scope.variables.set('target', {
                    isImmutable: false,
                    isolationLevel: ISOLATED,
                    lattice: RCTypeLattice.create({
                        type: TypeName.create({ name: 'MyType' }),
                    }),
                })
                context.scope.variables.set('value', {
                    isImmutable,
                    isolationLevel: SHARED,
                    lattice: RCTypeLattice.create({
                        type: TypeName.create({ name: 'MyType' }),
                    }),
                })
                context.scope.setCurrentValue(
                    'target',
                    RCTypeLattice.create({
                        type: TypeName.create({ name: 'MyType' }),
                    }),
                )
                context.scope.setCurrentValue(
                    'value',
                    RCTypeLattice.create({
                        type: TypeName.create({ name: 'MyType' }),
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
                const result = Failable.do(() =>
                    assignment.emitStatement(context),
                )
                assert(isFailure(result))
                expect(result.errors.map((e) => e.message)).toContain(
                    `Cannot assign SHARED value to ISOLATED target`,
                )
            })
        })
    })
    describe('throws if the value is UNKNOWN isolation level', () => {
        for (const isolationLevel of [ISOLATED, SHARED] as const) {
            test(isolationLevel, () => {
                const context = newSemanticContext()
                context.scope.rootScope.addDataDeclaration(
                    DataDeclaration.create({
                        name: TypeName.create({ name: 'MyType' }),
                        fields: [],
                    }),
                )
                context.scope.variables.set('target', {
                    isImmutable: false,
                    isolationLevel: isolationLevel,
                    lattice: RCTypeLattice.create({
                        type: TypeName.create({ name: 'MyType' }),
                    }),
                })
                context.scope.variables.set('value', {
                    isImmutable: true,
                    isolationLevel: UNKNOWN,
                    lattice: RCTypeLattice.create({
                        type: TypeName.create({ name: 'MyType' }),
                    }),
                })
                context.scope.setCurrentValue(
                    'value',
                    RCTypeLattice.create({
                        type: TypeName.create({ name: 'MyType' }),
                        fields: {},
                    }),
                )
                context.scope.setCurrentValue(
                    'target',
                    RCTypeLattice.create({
                        type: TypeName.create({ name: 'MyType' }),
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
                const result = Failable.do(() =>
                    assignment.emitStatement(context),
                )
                assert(isFailure(result))
                expect(result.errors.map((e) => e.message)).toContain(
                    'Parameter with unspecified isolation level may not be used in assignment',
                )
            })
        }
    })

    describe('updates current-value', () => {
        test('variable-reference', () => {
            const context = newSemanticContext()
            context.scope.variables.set('x', {
                isImmutable: true,
                isolationLevel: ISOLATED,
                lattice: IntegerLattice.unconstrained(),
            })
            context.scope.setCurrentValue('x', IntegerLattice.singleton(0n))

            const assignment = Assignment.create({
                target: VariableReference.create({
                    name: 'x',
                    span: someCodeSpan,
                }),
                value: IntegerLiteral.create({
                    value: 42n,
                    span: someCodeSpan,
                }),
                span: someCodeSpan,
            })
            Failable.do(() => assignment.emitStatement(context))
            expect(context.scope.currentValue('x')).not.toBeNil()
            expect(context.scope.currentValue('x')).toMatchObject({
                min: 42n,
                max: 42n,
            })
        })

        test('field-reference', () => {
            const context = newSemanticContext()
            context.scope.rootScope.addDataDeclaration(
                DataDeclaration.create({
                    name: TypeName.create({ name: 'MyType' }),
                    fields: [
                        {
                            name: 'field',
                            isImmutable: false,
                            isolationLevel: ISOLATED,
                            lattice: decorateLattice(
                                IntegerLattice.unconstrained(),
                                { span: someCodeSpan },
                            ),
                        },
                    ],
                }),
            )
            context.scope.variables.set('x', {
                isImmutable: true,
                isolationLevel: ISOLATED,
                lattice: RCTypeLattice.create({
                    type: TypeName.create({ name: 'MyType' }),
                }),
            })
            context.scope.setCurrentValue(
                'x',
                RCTypeLattice.create({
                    type: TypeName.create({ name: 'MyType' }),
                    fields: {},
                }),
            )

            const assignment = Assignment.create({
                target: FieldReference.create({
                    object: VariableReference.create({
                        name: 'x',
                        span: someCodeSpan,
                    }),
                    operator: '.',
                    field: 'field',
                    fieldSpan: someCodeSpan,
                    span: someCodeSpan,
                }),
                value: IntegerLiteral.create({
                    value: 42n,
                    span: someCodeSpan,
                }),
                span: someCodeSpan,
            })
            Failable.do(() => assignment.emitStatement(context))
            expect(context.scope.currentValue('x')).not.toBeNil()
            expect(context.scope.currentValue('x')).toMatchObject({
                fields: { field: { min: 42n, max: 42n } },
            })
        })
    })
})
