import { describe, expect, it, test } from 'bun:test'
import { FieldReference } from '../../../src/model/field-reference'
import { VariableReference } from '../../../src/model/variable-reference'
import { newSemanticContext, someCodeSpan } from '../../util'
import { DataDeclaration } from '../../../src/model/data-declaration'
import { TypeName } from '../../../src/model/type-name'
import { IntegerLattice, RCTypeLattice } from '../../../src/model/lattice'
import { ISOLATED, SHARED, UNKNOWN } from '../../../src/model/isolation-level'
import { decorateLattice } from '../../../src/model/lattice-declaration'
import { Failable, isFailure, isSuccess } from '../../../src/model/failable'
import assert from 'assert'

describe('Field Reference', () => {
    it('infers its type from the context', () => {
        const context = newSemanticContext()
        context.scope.variables.set('myVar', {
            isImmutable: false,
            isolationLevel: ISOLATED,
            lattice: RCTypeLattice.create({
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
                        lattice: decorateLattice(
                            IntegerLattice.unconstrained(),
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
        const result = Failable.do(() => fieldRef.declaredLattice(context))
        assert(isSuccess(result))
        expect(result.value.toCIR().type).toBe('integer')
    })

    it('infers its isolation level from the context', () => {
        const context = newSemanticContext()
        context.scope.variables.set('myVar', {
            isImmutable: false,
            isolationLevel: ISOLATED,
            lattice: RCTypeLattice.create({
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
                        lattice: decorateLattice(
                            RCTypeLattice.create({
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
        const result = Failable.do(() => fieldRef.isolationLevel(context))
        assert(isSuccess(result))
        expect(result.value).toEqual(SHARED)
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
                context.scope.variables.set('myVar', {
                    isImmutable,
                    isolationLevel: expected,
                    lattice: RCTypeLattice.create({
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
                const result = Failable.do(function* () {
                    return Failable.success([
                        yield yield* fieldRef.isolationLevel(context),
                        yield yield* fieldRef.declaredLattice(context),
                    ])
                })
                assert(isSuccess(result))
                expect(result.value).toMatchObject([
                    expected,
                    {
                        type: { name: 'InnerType' },
                    },
                ])
            })
    })

    it('throws if the field does not exist on the type', () => {
        const context = newSemanticContext()
        context.scope.variables.set('myVar', {
            isImmutable: false,
            isolationLevel: ISOLATED,
            lattice: RCTypeLattice.create({
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
                        lattice: decorateLattice(
                            IntegerLattice.unconstrained(),
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
            field: 'nonExistentField',
            span: someCodeSpan,
            fieldSpan: someCodeSpan,
        })
        const result = Failable.do(() => fieldRef.toCIRExpression(context))
        assert(isFailure(result))
        expect(result.errors.map((e) => e.message)).toContain(
            'Field nonExistentField does not exist on type MyType',
        )
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
                context.scope.variables.set('myVar', {
                    isImmutable,
                    isolationLevel: isolationLevel,
                    lattice: RCTypeLattice.create({
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
                                lattice: decorateLattice(
                                    IntegerLattice.unconstrained(),
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
                const result = Failable.do(() =>
                    fieldRef.toCIRExpression(context),
                )
                assert(isFailure(result))
                expect(result.errors[0]).toMatchObject({
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
                context.scope.variables.set('myVar', {
                    isImmutable,
                    isolationLevel,
                    lattice: RCTypeLattice.create({
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
                                lattice: decorateLattice(
                                    IntegerLattice.unconstrained(),
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
                const result = Failable.do(() =>
                    fieldRef.isEffectivelyConst(context),
                )
                assert(isSuccess(result))
                expect(result.value).toBe(expected)
            })
        }

        it('returns true if the object is ISOLATED immutable', () => {
            const context = newSemanticContext()
            context.scope.variables.set('myVar', {
                isImmutable: true,
                isolationLevel: ISOLATED,
                lattice: RCTypeLattice.create({
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
                            lattice: decorateLattice(
                                IntegerLattice.unconstrained(),
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
            const result = Failable.do(() =>
                fieldRef.isEffectivelyConst(context),
            )
            assert(isSuccess(result))
            expect(result.value).toBeTrue()
        })

        it('returns true if the object is UNKNOWN immutable', () => {
            const context = newSemanticContext()
            context.scope.variables.set('myVar', {
                isImmutable: true,
                isolationLevel: UNKNOWN,
                lattice: RCTypeLattice.create({
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
                            lattice: decorateLattice(
                                IntegerLattice.unconstrained(),
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
            const result = Failable.do(() =>
                fieldRef.isEffectivelyConst(context),
            )
            assert(isSuccess(result))
            expect(result.value).toBeTrue()
        })

        it('returns false if the object is mutable', () => {
            const context = newSemanticContext()
            context.scope.variables.set('myVar', {
                isImmutable: false,
                isolationLevel: ISOLATED,
                lattice: RCTypeLattice.create({
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
                            lattice: decorateLattice(
                                IntegerLattice.unconstrained(),
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
            const result = Failable.do(() =>
                fieldRef.isEffectivelyConst(context),
            )
            assert(isSuccess(result))
            expect(result.value).toBeFalse()
        })
    })
})
