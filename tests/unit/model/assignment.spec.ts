import { Assignment } from '@/model/assignment'
import { DataDeclaration } from '@/model/data-declaration'
import { DataLiteral } from '@/model/data-literal'
import { FieldReference } from '@/model/field-reference'
import { FunctionCall } from '@/model/function-call'
import { FunctionDeclaration } from '@/model/function-declaration'
import { IntegerLiteral } from '@/model/integer-literal'
import { ISOLATED, SHARED, UNIQUE, UNKNOWN } from '@/model/isolation-level'
import { ObjectDeclaration } from '@/model/object-declaration'
import { IntegerRange, RCTypeSet } from '@/model/value-set'
import { VariableReference } from '@/model/variable-reference'
import * as util from '@@/util'
import { describe, expect, it, test } from 'bun:test'

describe('Assignment', () => {
    it('outputs the correct CIR representation', () => {
        const context = util.newSemanticContext()
        context.scope.addVariableDeclaration('x', util.someIntegerVariable)
        context.scope.setCurrentValue('x', IntegerRange.singleton(0n))

        const assignment = Assignment.create({
            target: util.variableRef('x'),
            value: util.integerLiteral(42),
            span: util.someCodeSpan,
        })

        const result = assignment.emitStatement(context)
        expect(result.isSuccess || result.error.errors).toBeTrue()

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

    it('accepts data-literal as value', () => {
        const context = util.newSemanticContext()
        context.scope.rootScope.addDataDeclaration(
            DataDeclaration.create({
                name: util.simpleTypeName('MyData'),
                fields: [{ ...util.someFieldDeclConfig, name: 'field' }],
            }),
        )
        context.scope.addVariableDeclaration('x', {
            ...util.someIntegerVariable,
            domain: RCTypeSet.create({
                type: util.simpleTypeName('MyData'),
                fields: { field: IntegerRange.singleton(12n) },
            }),
        })

        const assignment = Assignment.create({
            target: util.variableRef('x'),
            value: DataLiteral.create({
                fields: [{ name: 'field', value: util.integerLiteral(1) }],
                span: util.someCodeSpan,
            }),
            span: util.someCodeSpan,
        })

        assignment.emitStatement(context)

        expect(context.scope.emitted).toMatchObject([
            {
                kind: 'ASSIGN',
                target: { kind: 'VARIABLE_REF', name: 'x' },
                value: {
                    fields: [
                        {
                            name: 'field',
                            domain: { min: '1', max: '1' },
                            value: {
                                kind: 'INTEGER_LITERAL',
                                value: { min: '1', max: '1' },
                            },
                        },
                    ],
                },
            },
        ])
    })

    describe('injects RELEASE/RETAIN statements', () => {
        test('for a FieldReference', () => {
            const context = util.newSemanticContext()
            context.scope.rootScope.addDataDeclaration(
                DataDeclaration.create({
                    name: util.simpleTypeName('InnerType'),
                    fields: [
                        { ...util.someFieldDeclConfig, name: 'innerField' },
                    ],
                }),
            )
            context.scope.rootScope.addDataDeclaration(
                DataDeclaration.create({
                    name: util.simpleTypeName('OuterType'),
                    fields: [
                        {
                            ...util.someFieldDeclConfig,
                            name: 'field',
                            domain: util.spannedDomain(
                                RCTypeSet.create({
                                    type: util.simpleTypeName('InnerType'),
                                }),
                            ),
                        },
                    ],
                }),
            )
            context.scope.addVariableDeclaration('bar', {
                ...util.someIntegerVariable,
                domain: RCTypeSet.create({
                    type: util.simpleTypeName('OuterType'),
                }),
            })
            context.scope.addVariableDeclaration('foo', {
                ...util.someIntegerVariable,
                domain: RCTypeSet.create({
                    type: util.simpleTypeName('InnerType'),
                }),
            })

            const assignment = Assignment.create({
                target: util.variableRef('foo'),
                value: util.isolatedFieldRef(util.variableRef('bar'), 'field'),
                span: util.someCodeSpan,
            })

            assignment.emitStatement(context)
            expect(context.scope.emitted).toMatchObject([
                {
                    kind: 'VARIABLE_DECL',
                    name: '__tempˇ0',
                    domain: {
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
            const context = util.newSemanticContext()
            context.scope.rootScope.addDataDeclaration(
                DataDeclaration.create({
                    name: util.simpleTypeName('MyType'),
                    fields: [],
                }),
            )
            context.scope.addVariableDeclaration('bar', {
                ...util.someIntegerVariable,
                domain: RCTypeSet.create({
                    type: util.simpleTypeName('MyType'),
                }),
            })
            context.scope.addVariableDeclaration('foo', {
                ...util.someIntegerVariable,
                domain: RCTypeSet.create({
                    type: util.simpleTypeName('MyType'),
                }),
            })

            const assignment = Assignment.create({
                target: util.variableRef('foo'),
                value: util.variableRef('bar'),
                span: util.someCodeSpan,
            })

            assignment.emitStatement(context)
            expect(context.scope.emitted).toMatchObject([
                {
                    kind: 'VARIABLE_DECL',
                    name: '__tempˇ0',
                    domain: {
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

    describe('outputs an initializer literal as CALL', () => {
        test('for a FieldReference', () => {
            const context = util.newSemanticContext()
            context.scope.rootScope.addObjectDeclaration(
                ObjectDeclaration.create({
                    ...util.someObjectDeclConfig,
                    name: util.simpleTypeName('MyType'),
                    initializers: [
                        FunctionDeclaration.create({
                            baseName: 'new',
                            parameters: [],
                            implementation: { kind: 'body', statements: [] },
                            result: undefined,
                        }),
                    ],
                }),
            )
            context.scope.rootScope.addDataDeclaration(
                DataDeclaration.create({
                    name: util.simpleTypeName('MyData'),
                    fields: [
                        {
                            ...util.someFieldDeclConfig,
                            name: 'field',
                            domain: util.spannedDomain(
                                RCTypeSet.create({
                                    type: util.simpleTypeName('MyType'),
                                }),
                            ),
                        },
                    ],
                }),
            )
            context.scope.addVariableDeclaration('x', {
                ...util.someIntegerVariable,
                domain: RCTypeSet.create({
                    type: util.simpleTypeName('MyData'),
                }),
            })

            const assignment = Assignment.create({
                target: util.isolatedFieldRef(util.variableRef('x'), 'field'),
                value: DataLiteral.create({
                    initializerCall: FunctionCall.create({
                        baseName: 'new',
                        arguments: [],
                        span: util.someCodeSpan,
                    }),
                    fields: [],
                    span: util.someCodeSpan,
                }),
                span: util.someCodeSpan,
            })

            expect(assignment.emitStatement(context).isSuccess).toBeTrue()
            expect(context.scope.emitted).toMatchObject([
                { kind: 'ENSURE_UNIQUE' },
                {
                    kind: 'ASSIGN',
                    target: {
                        field: 'field',
                        object: { name: 'x' },
                    },
                    value: { fields: [] },
                },
                {
                    kind: 'CALL',
                    name: {
                        baseName: 'new',
                        labels: [],
                    },
                    arguments: [],
                    receiver: {
                        dispatch: 'direct',
                        object: {
                            kind: 'FIELD_REF',
                            field: 'field',
                            object: { name: 'x' },
                        },
                    },
                },
            ])
        })

        test('for a VariableReference', () => {
            const context = util.newSemanticContext()
            context.scope.rootScope.addObjectDeclaration(
                ObjectDeclaration.create({
                    ...util.someObjectDeclConfig,
                    name: util.simpleTypeName('MyType'),
                    initializers: [
                        FunctionDeclaration.create({
                            baseName: 'new',
                            parameters: [],
                            implementation: { kind: 'body', statements: [] },
                            result: undefined,
                        }),
                    ],
                }),
            )
            context.scope.addVariableDeclaration('x', {
                ...util.someIntegerVariable,
                domain: RCTypeSet.create({
                    type: util.simpleTypeName('MyType'),
                }),
            })

            const assignment = Assignment.create({
                target: util.variableRef('x'),
                value: DataLiteral.create({
                    initializerCall: FunctionCall.create({
                        baseName: 'new',
                        arguments: [],
                        span: util.someCodeSpan,
                    }),
                    fields: [],
                    span: util.someCodeSpan,
                }),
                span: util.someCodeSpan,
            })

            expect(assignment.emitStatement(context).isSuccess).toBeTrue()
            expect(context.scope.emitted).toMatchObject([
                {
                    kind: 'ASSIGN',
                    target: { name: 'x' },
                    value: { fields: [] },
                },
                {
                    kind: 'CALL',
                    name: {
                        baseName: 'new',
                        labels: [],
                    },
                    arguments: [],
                    receiver: {
                        dispatch: 'direct',
                        object: { name: 'x' },
                    },
                },
            ])
        })
    })

    it('injects ENSURE_UNIQUE for ISOLATED target before assignment', () => {
        const context = util.newSemanticContext()
        context.scope.rootScope.addDataDeclaration(
            DataDeclaration.create({
                name: util.simpleTypeName('MyType'),
                fields: [{ ...util.someFieldDeclConfig, name: 'field' }],
            }),
        )
        context.scope.addVariableDeclaration('foo', {
            ...util.someIntegerVariable,
            domain: RCTypeSet.create({
                type: util.simpleTypeName('MyType'),
            }),
        })

        const assignment = Assignment.create({
            target: util.isolatedFieldRef(util.variableRef('foo'), 'field'),
            value: util.integerLiteral(42),
            span: util.someCodeSpan,
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
        const context = util.newSemanticContext()
        context.scope.rootScope.addDataDeclaration(
            DataDeclaration.create({
                name: util.simpleTypeName('MyType'),
                fields: [],
            }),
        )
        context.scope.rootScope.addFunctionDeclaration(
            FunctionDeclaration.create({
                baseName: 'myFunction',
                result: {
                    domain: util.spannedDomain(
                        RCTypeSet.create({
                            type: util.simpleTypeName('MyType'),
                        }),
                    ),
                    isolationLevel: UNIQUE,
                },
                parameters: [],
                implementation: {
                    kind: 'implicit-return',
                    expression: util.variableRef('mutVar'),
                },
            }),
        )
        context.scope.rootScope.addVariableDeclaration('refVar', {
            isImmutable: false,
            isolationLevel: SHARED,
            domain: RCTypeSet.create({
                type: util.simpleTypeName('MyType'),
            }),
        })
        context.scope.rootScope.addVariableDeclaration('mutVar', {
            ...util.someIntegerVariable,
            domain: RCTypeSet.create({
                type: util.simpleTypeName('MyType'),
            }),
        })

        const assignment = Assignment.create({
            target: util.variableRef('refVar'),
            value: FunctionCall.create({
                baseName: 'myFunction',
                arguments: [],
                span: util.someCodeSpan,
            }),
            span: util.someCodeSpan,
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
            value: util.integerLiteral(42),
            span: util.someCodeSpan,
        })
        const result = assignment.emitStatement(util.newSemanticContext())
        expect(
            result.isError && result.error.errors.map((e) => e.message),
        ).toContain('Variable x is not defined in the current context')
    })

    describe('throws if the target variable is immutable/non-assignable', () => {
        for (const isolationLevel of [ISOLATED, SHARED] as const) {
            test(isolationLevel, () => {
                const context = util.newSemanticContext()
                context.scope.rootScope.addDataDeclaration(
                    DataDeclaration.create({
                        name: util.simpleTypeName('MyType'),
                        fields: [],
                    }),
                )
                context.scope.addVariableDeclaration('target', {
                    isImmutable: true,
                    isolationLevel,
                    domain: RCTypeSet.create({
                        type: util.simpleTypeName('MyType'),
                    }),
                })
                context.scope.addVariableDeclaration('value', {
                    isImmutable: true,
                    isolationLevel,
                    domain: RCTypeSet.create({
                        type: util.simpleTypeName('MyType'),
                    }),
                })

                const assignment = Assignment.create({
                    target: VariableReference.create({
                        name: 'target',
                        span: {
                            start: { line: 1, column: 1 },
                            end: { line: 1, column: 2 },
                        },
                    }),
                    value: util.variableRef('value'),
                    span: util.someCodeSpan,
                })
                const result = assignment.emitStatement(context)
                expect(result.isError && result.error.errors).toMatchObject([
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
        const context = util.newSemanticContext()
        context.scope.rootScope.addDataDeclaration(
            DataDeclaration.create({
                name: util.simpleTypeName('MyType'),
                fields: [{ ...util.someFieldDeclConfig, name: 'myField' }],
            }),
        )
        context.scope.addVariableDeclaration('x', {
            isImmutable: true,
            isolationLevel: ISOLATED,
            domain: RCTypeSet.create({
                type: util.simpleTypeName('MyType'),
            }),
        })

        const assignment = Assignment.create({
            target: FieldReference.create({
                object: util.variableRef('x'),
                operator: '.',
                field: 'myField',
                span: {
                    start: { line: 1, column: 3 },
                    end: { line: 1, column: 4 },
                },
                fieldSpan: util.someCodeSpan,
            }),
            value: util.integerLiteral(42),
            span: util.someCodeSpan,
        })
        const result = assignment.emitStatement(context)

        expect(result.isError && result.error.errors).toMatchObject([
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
        const context = util.newSemanticContext()
        context.scope.rootScope.addDataDeclaration(
            DataDeclaration.create({
                name: util.simpleTypeName('MyType'),
                fields: [{ ...util.someFieldDeclConfig, name: 'myField' }],
            }),
        )
        context.scope.addVariableDeclaration('x', {
            isImmutable: true,
            isolationLevel: UNKNOWN,
            domain: RCTypeSet.create({
                type: util.simpleTypeName('MyType'),
            }),
        })

        const assignment = Assignment.create({
            target: FieldReference.create({
                object: util.variableRef('x'),
                operator: '.',
                field: 'myField',
                span: {
                    start: { line: 1, column: 3 },
                    end: { line: 1, column: 4 },
                },
                fieldSpan: util.someCodeSpan,
            }),
            value: IntegerLiteral.create({
                value: 42n,
                span: util.someCodeSpan,
            }),
            span: util.someCodeSpan,
        })

        const result = assignment.emitStatement(context)
        expect(result.isError && result.error.errors).toMatchObject([
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
                const context = util.newSemanticContext()
                context.scope.rootScope.addDataDeclaration(
                    DataDeclaration.create({
                        name: util.simpleTypeName('MyType'),
                        fields: [
                            { ...util.someFieldDeclConfig, name: 'myField' },
                        ],
                    }),
                )
                context.scope.addVariableDeclaration('target', {
                    ...util.someIntegerVariable,
                    domain: RCTypeSet.create({
                        type: util.simpleTypeName('MyType'),
                    }),
                })
                context.scope.addVariableDeclaration('value', {
                    isImmutable,
                    isolationLevel: SHARED,
                    domain: RCTypeSet.create({
                        type: util.simpleTypeName('MyType'),
                    }),
                })
                const assignment = Assignment.create({
                    target: util.variableRef('target'),
                    value: util.variableRef('value'),
                    span: {
                        start: { line: 1, column: 3 },
                        end: { line: 1, column: 4 },
                    },
                })
                const result = assignment.emitStatement(context)
                expect(
                    result.isError && result.error.errors.map((e) => e.message),
                ).toContain(`Cannot assign SHARED value to ISOLATED target`)
            })
        })
    })

    describe('throws if the value is UNKNOWN isolation level', () => {
        for (const isolationLevel of [ISOLATED, SHARED] as const) {
            test(isolationLevel, () => {
                const context = util.newSemanticContext()
                context.scope.rootScope.addDataDeclaration(
                    DataDeclaration.create({
                        name: util.simpleTypeName('MyType'),
                        fields: [],
                    }),
                )
                context.scope.addVariableDeclaration('target', {
                    isImmutable: false,
                    isolationLevel,
                    domain: RCTypeSet.create({
                        type: util.simpleTypeName('MyType'),
                    }),
                })
                context.scope.addVariableDeclaration('value', {
                    isImmutable: true,
                    isolationLevel: UNKNOWN,
                    domain: RCTypeSet.create({
                        type: util.simpleTypeName('MyType'),
                    }),
                })

                const assignment = Assignment.create({
                    target: VariableReference.create({
                        name: 'target',
                        span: {
                            start: { line: 1, column: 1 },
                            end: { line: 1, column: 2 },
                        },
                    }),
                    value: util.variableRef('value'),
                    span: util.someCodeSpan,
                })
                const result = assignment.emitStatement(context)
                expect(
                    result.isError && result.error.errors.map((e) => e.message),
                ).toContain(
                    'Parameter with unspecified isolation level may not be used in assignment',
                )
            })
        }
    })

    describe('updates current-value', () => {
        test('variable-reference', () => {
            const context = util.newSemanticContext()
            context.scope.addVariableDeclaration('x', util.someIntegerVariable)

            const assignment = Assignment.create({
                target: util.variableRef('x'),
                value: util.integerLiteral(42),
                span: util.someCodeSpan,
            })
            const result = assignment.emitStatement(context)
            expect(result).toMatchObject({ value: undefined })
            expect(context.scope.currentValue('x')).not.toBeNil()
            expect(context.scope.currentValue('x')).toMatchObject({
                min: 42n,
                max: 42n,
            })
        })

        test('field-reference', () => {
            const context = util.newSemanticContext()
            context.scope.rootScope.addDataDeclaration(
                DataDeclaration.create({
                    name: util.simpleTypeName('MyType'),
                    fields: [{ ...util.someFieldDeclConfig, name: 'field' }],
                }),
            )
            context.scope.addVariableDeclaration('x', {
                isImmutable: true,
                isolationLevel: SHARED,
                domain: RCTypeSet.create({
                    type: util.simpleTypeName('MyType'),
                }),
            })
            context.scope.setCurrentValue(
                'x',
                RCTypeSet.create({
                    type: util.simpleTypeName('MyType'),
                    fields: {},
                }),
            )

            const assignment = Assignment.create({
                target: util.sharedFieldRef(util.variableRef('x'), 'field'),
                value: util.integerLiteral(42),
                span: util.someCodeSpan,
            })
            const result = assignment.emitStatement(context)
            expect(result.isError && result.error.errors).toBeFalse()
            expect(context.scope.currentValue('x')).not.toBeNil()
            expect(context.scope.currentValue('x')).toMatchObject({
                fields: { field: { min: 42n, max: 42n } },
            })
        })
    })
})
