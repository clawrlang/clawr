import { DataDeclaration } from '@/model/data-declaration'
import { decorateDomain } from '@/model/domain-declaration'
import { FieldReference } from '@/model/field-reference'
import { ISOLATED, SHARED, UNKNOWN } from '@/model/isolation-level'
import { ObjectDeclaration } from '@/model/object-declaration'
import { TypeName } from '@/model/type-name'
import { IntegerRange, RCTypeSet } from '@/model/value-set'
import { VariableReference } from '@/model/variable-reference'
import { SemanticResult } from '@/tools/semantic-result'
import { newSemanticContext, someCodeSpan } from '@@/util'
import { describe, expect, it, test } from 'bun:test'

describe('Field Reference', () => {
    it('infers its type from the context', () => {
        const context = newSemanticContext()
        context.scope.addVariableDeclaration('myVar', {
            isImmutable: false,
            isolationLevel: ISOLATED,
            domain: RCTypeSet.create({
                type: TypeName.create({ name: 'MyType' }),
            }),
        })
        context.scope.rootScope.addDataDeclaration(
            DataDeclaration.create({
                name: TypeName.create({ name: 'MyType' }),
                fields: [
                    {
                        name: 'myField',
                        isImmutable: false,
                        isolationLevel: ISOLATED,
                        domain: decorateDomain(IntegerRange.unconstrained(), {
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
        const result = fieldRef.domain(context)
        expect(result.isSuccess && result.value.toCIR().type).toBe('integer')
    })

    it('infers its isolation level from the context', () => {
        const context = newSemanticContext()
        context.scope.addVariableDeclaration('myVar', {
            isImmutable: false,
            isolationLevel: ISOLATED,
            domain: RCTypeSet.create({
                type: TypeName.create({ name: 'MyType' }),
            }),
        })
        context.scope.rootScope.addDataDeclaration(
            DataDeclaration.create({
                name: TypeName.create({ name: 'MyType' }),
                fields: [
                    {
                        isImmutable: true,
                        name: 'myField',
                        isolationLevel: SHARED,
                        domain: decorateDomain(
                            RCTypeSet.create({
                                type: TypeName.create({ name: 'MyType' }),
                            }),
                            { span: someCodeSpan },
                        ),
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
        const result = fieldRef.isolationLevel(context)
        expect(result.isSuccess && result.value).toEqual(SHARED)
    })

    describe('infers its type and isolation level from the context', () => {
        const cases = [
            {
                keyword: 'const',
                isImmutable: true,
                expected: ISOLATED,
            },
            {
                keyword: 'mut',
                isImmutable: false,
                expected: ISOLATED,
            },
            {
                keyword: 'ref',
                isImmutable: true,
                expected: SHARED,
            },
            {
                keyword: 'mutref',
                isImmutable: false,
                expected: SHARED,
            },
        ] as const

        for (const { keyword, isImmutable, expected } of cases)
            test(`${keyword} object`, () => {
                const context = newSemanticContext()
                context.scope.addVariableDeclaration('myVar', {
                    isImmutable,
                    isolationLevel: expected,
                    domain: RCTypeSet.create({
                        type: TypeName.create({ name: 'MyType' }),
                    }),
                })
                context.scope.rootScope.addDataDeclaration(
                    DataDeclaration.create({
                        name: TypeName.create({ name: 'InnerType' }),
                        fields: [],
                    }),
                )
                context.scope.rootScope.addDataDeclaration(
                    DataDeclaration.create({
                        name: TypeName.create({ name: 'MyType' }),
                        fields: [
                            {
                                isImmutable,
                                name: 'myField',
                                isolationLevel: expected,
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

                const fieldRef = FieldReference.create({
                    object: VariableReference.create({
                        name: 'myVar',
                        span: someCodeSpan,
                    }),
                    operator: expected === SHARED ? '->' : '.',
                    field: 'myField',
                    span: someCodeSpan,
                    fieldSpan: someCodeSpan,
                })
                const result = SemanticResult.collect([
                    fieldRef.isolationLevel(context),
                    fieldRef.domain(context),
                ])

                expect(result.isSuccess && result.value).toMatchObject([
                    expected,
                    {
                        type: { name: 'InnerType' },
                    },
                ])
            })
    })

    it('throws if the field does not exist on the type', () => {
        const context = newSemanticContext()
        context.scope.addVariableDeclaration('myVar', {
            isImmutable: false,
            isolationLevel: ISOLATED,
            domain: RCTypeSet.create({
                type: TypeName.create({ name: 'MyType' }),
            }),
        })
        context.scope.rootScope.addDataDeclaration(
            DataDeclaration.create({
                name: TypeName.create({ name: 'MyType' }),
                fields: [
                    {
                        isImmutable: false,
                        name: 'myField',
                        isolationLevel: ISOLATED,
                        domain: decorateDomain(IntegerRange.unconstrained(), {
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
        const result = fieldRef.toCIRExpression(context)
        expect(
            result.isError && result.error.errors.map((e) => e.message),
        ).toContain('Field nonExistentField does not exist on type MyType')
    })

    describe('throws if the object’s isolation-level is not compatible with the operator', () => {
        const cases = [
            {
                operator: '->',
                isImmutable: true,
                isolationLevel: ISOLATED,
            },
            {
                operator: '->',
                isImmutable: false,
                isolationLevel: ISOLATED,
            },
            {
                operator: '.',
                isImmutable: true,
                isolationLevel: SHARED,
            },
            {
                operator: '.',
                isImmutable: false,
                isolationLevel: SHARED,
            },
        ] as const

        for (const { operator, isImmutable, isolationLevel } of cases) {
            test(`${isolationLevel} with "${operator}"`, () => {
                const context = newSemanticContext()
                context.scope.addVariableDeclaration('myVar', {
                    isImmutable,
                    isolationLevel: isolationLevel,
                    domain: RCTypeSet.create({
                        type: TypeName.create({ name: 'MyType' }),
                    }),
                })
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
                expect(result.isError && result.error.errors[0]).toMatchObject({
                    message: `Cannot access field myField of a ${isolationLevel} type object with "${operator}" operator`,
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
                isImmutable: true,
                isolationLevel: ISOLATED,
                expected: true,
            },
            {
                isImmutable: false,
                isolationLevel: ISOLATED,
                expected: false,
            },
            {
                isImmutable: true,
                isolationLevel: SHARED,
                expected: false,
            },
            {
                isImmutable: false,
                isolationLevel: SHARED,
                expected: false,
            },
        ] as const

        for (const { isImmutable, isolationLevel, expected } of cases) {
            it(`returns ${expected} if the object is ${isolationLevel}`, () => {
                const context = newSemanticContext()
                context.scope.addVariableDeclaration('myVar', {
                    isImmutable,
                    isolationLevel,
                    domain: RCTypeSet.create({
                        type: TypeName.create({ name: 'MyType' }),
                    }),
                })
                context.scope.rootScope.addDataDeclaration(
                    DataDeclaration.create({
                        name: TypeName.create({ name: 'MyType' }),
                        fields: [
                            {
                                name: 'myField',
                                isImmutable,
                                isolationLevel: ISOLATED,
                                domain: decorateDomain(
                                    IntegerRange.unconstrained(),
                                    { span: someCodeSpan },
                                ),
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
                const result = fieldRef.isEffectivelyConst(context)
                expect(result.isSuccess && result.value).toBe(expected)
            })
        }

        it('returns true if the object is ISOLATED immutable', () => {
            const context = newSemanticContext()
            context.scope.addVariableDeclaration('myVar', {
                isImmutable: true,
                isolationLevel: ISOLATED,
                domain: RCTypeSet.create({
                    type: TypeName.create({ name: 'MyType' }),
                }),
            })
            context.scope.rootScope.addDataDeclaration(
                DataDeclaration.create({
                    name: TypeName.create({ name: 'MyType' }),
                    fields: [
                        {
                            isImmutable: false,
                            name: 'myField',
                            isolationLevel: ISOLATED,
                            domain: decorateDomain(
                                IntegerRange.unconstrained(),
                                { span: someCodeSpan },
                            ),
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
            const result = fieldRef.isEffectivelyConst(context)
            expect(result.isSuccess && result.value).toBeTrue()
        })

        it('returns true if the object is UNKNOWN immutable', () => {
            const context = newSemanticContext()
            context.scope.addVariableDeclaration('myVar', {
                isImmutable: true,
                isolationLevel: UNKNOWN,
                domain: RCTypeSet.create({
                    type: TypeName.create({ name: 'MyType' }),
                }),
            })
            context.scope.rootScope.addDataDeclaration(
                DataDeclaration.create({
                    name: TypeName.create({ name: 'MyType' }),
                    fields: [
                        {
                            isImmutable: false,
                            name: 'myField',
                            isolationLevel: ISOLATED,
                            domain: decorateDomain(
                                IntegerRange.unconstrained(),
                                { span: someCodeSpan },
                            ),
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
            const result = fieldRef.isEffectivelyConst(context)
            expect(result.isSuccess && result.value).toBeTrue()
        })

        it('returns false if the object is mutable', () => {
            const context = newSemanticContext()
            context.scope.addVariableDeclaration('myVar', {
                isImmutable: false,
                isolationLevel: ISOLATED,
                domain: RCTypeSet.create({
                    type: TypeName.create({ name: 'MyType' }),
                }),
            })
            context.scope.rootScope.addDataDeclaration(
                DataDeclaration.create({
                    name: TypeName.create({ name: 'MyType' }),
                    fields: [
                        {
                            isImmutable: false,
                            name: 'myField',
                            isolationLevel: ISOLATED,
                            domain: decorateDomain(
                                IntegerRange.unconstrained(),
                                { span: someCodeSpan },
                            ),
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
            const result = fieldRef.isEffectivelyConst(context)
            expect(result.isSuccess).toBeTrue()
            expect(result.isSuccess && result.value).toBeFalse()
        })
    })

    describe('current value', () => {
        it('returns the declared domain (Data)', () => {
            const context = newSemanticContext()
            context.scope.rootScope.addDataDeclaration(
                DataDeclaration.create({
                    name: TypeName.create({ name: 'Data' }),
                    fields: [
                        {
                            name: 'field',
                            isImmutable: false,
                            isolationLevel: 'ISOLATED',
                            domain: decorateDomain(
                                IntegerRange.create({ max: 100n, min: 0n }),
                                { span: someCodeSpan },
                            ),
                        },
                    ],
                }),
            )
            context.scope.addVariableDeclaration('myVar', {
                isImmutable: false,
                isolationLevel: ISOLATED,
                domain: RCTypeSet.create({
                    type: TypeName.create({ name: 'Data' }),
                }),
            })

            const fieldRef = FieldReference.create({
                object: VariableReference.create({
                    name: 'myVar',
                    span: someCodeSpan,
                }),
                operator: '.',
                field: 'field',
                span: someCodeSpan,
                fieldSpan: someCodeSpan,
            })
            const result = fieldRef.currentValue(context)

            expect(result).toMatchObject({ value: { min: 0n, max: 100n } })
        })

        it('returns the declared domain (Object)', () => {
            const context = newSemanticContext()
            context.scope.rootScope.addObjectDeclaration(
                ObjectDeclaration.create({
                    name: TypeName.create({ name: 'Object' }),
                    kind: 'object',
                    readonly: [],
                    mutating: [],
                    initializers: [],
                    fields: [
                        {
                            name: 'field',
                            isImmutable: false,
                            isolationLevel: 'ISOLATED',
                            domain: decorateDomain(
                                IntegerRange.create({ max: 100n, min: 0n }),
                                { span: someCodeSpan },
                            ),
                        },
                    ],
                    span: someCodeSpan,
                }),
            )
            context.scope.addVariableDeclaration('myVar', {
                isImmutable: false,
                isolationLevel: ISOLATED,
                domain: RCTypeSet.create({
                    type: TypeName.create({ name: 'Object' }),
                }),
            })

            const fieldRef = FieldReference.create({
                object: VariableReference.create({
                    name: 'myVar',
                    span: someCodeSpan,
                }),
                operator: '.',
                field: 'field',
                span: someCodeSpan,
                fieldSpan: someCodeSpan,
            })
            const result = fieldRef.currentValue(context)

            expect(result).toMatchObject({ value: { min: 0n, max: 100n } })
        })
    })
})
