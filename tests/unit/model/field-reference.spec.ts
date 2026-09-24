import { DataDeclaration } from '@/model/data-declaration'
import { FieldReference } from '@/model/field-reference'
import { ISOLATED, SHARED, UNKNOWN } from '@/model/isolation-level'
import { ObjectDeclaration } from '@/model/object-declaration'
import { TypeName } from '@/model/type-name'
import { IntegerRange, RCTypeSet } from '@/model/value-set'
import { SemanticResult } from '@/tools/semantic-result'
import * as util from '@@/util'
import { describe, expect, it, test } from 'bun:test'

describe('Field Reference', () => {
    it('infers its type from the context', () => {
        const context = util.newSemanticContext()
        context.scope.addVariableDeclaration('myVar', {
            ...util.someIntegerVariable,
            domain: RCTypeSet.create({
                type: util.simpleTypeName('MyType'),
            }),
        })
        context.scope.rootScope.addDataDeclaration(
            DataDeclaration.create({
                name: util.simpleTypeName('MyType'),
                fields: [{ ...util.someFieldDeclConfig, name: 'myField' }],
            }),
        )

        const fieldRef = util.isolatedFieldRef(
            util.variableRef('myVar'),
            'myField',
        )
        const result = fieldRef.domain(context)
        expect(result.isSuccess && result.value.toCIR().type).toBe('integer')
    })

    it('infers its isolation level from the context', () => {
        const context = util.newSemanticContext()
        context.scope.addVariableDeclaration('myVar', {
            ...util.someIntegerVariable,
            domain: RCTypeSet.create({
                type: util.simpleTypeName('MyType'),
            }),
        })
        context.scope.rootScope.addDataDeclaration(
            DataDeclaration.create({
                name: util.simpleTypeName('MyType'),
                fields: [
                    {
                        isImmutable: true,
                        name: 'myField',
                        isolationLevel: SHARED,
                        domain: util.spannedDomain(
                            RCTypeSet.create({
                                type: util.simpleTypeName('MyType'),
                            }),
                        ),
                    },
                ],
            }),
        )

        const fieldRef = util.isolatedFieldRef(
            util.variableRef('myVar'),
            'myField',
        )
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
                const context = util.newSemanticContext()
                context.scope.addVariableDeclaration('myVar', {
                    isImmutable,
                    isolationLevel: expected,
                    domain: RCTypeSet.create({
                        type: util.simpleTypeName('MyType'),
                    }),
                })
                context.scope.rootScope.addDataDeclaration(
                    DataDeclaration.create({
                        name: util.simpleTypeName('InnerType'),
                        fields: [],
                    }),
                )
                context.scope.rootScope.addDataDeclaration(
                    DataDeclaration.create({
                        name: util.simpleTypeName('MyType'),
                        fields: [
                            {
                                isImmutable,
                                name: 'myField',
                                isolationLevel: expected,
                                domain: util.spannedDomain(
                                    RCTypeSet.create({
                                        type: util.simpleTypeName('InnerType'),
                                    }),
                                ),
                            },
                        ],
                    }),
                )

                const fieldRef =
                    expected === SHARED
                        ? util.sharedFieldRef(
                              util.variableRef('myVar'),
                              'myField',
                          )
                        : util.isolatedFieldRef(
                              util.variableRef('myVar'),
                              'myField',
                          )
                const result = SemanticResult.collect([
                    fieldRef.isolationLevel(context),
                    fieldRef.domain(context),
                ])

                expect(result.isSuccess && result.value).toMatchObject([
                    expected,
                    { type: { name: 'InnerType' } },
                ])
            })
    })

    it('throws if the field does not exist on the type', () => {
        const context = util.newSemanticContext()
        context.scope.addVariableDeclaration('myVar', {
            ...util.someIntegerVariable,
            domain: RCTypeSet.create({
                type: util.simpleTypeName('MyType'),
            }),
        })
        context.scope.rootScope.addDataDeclaration(
            DataDeclaration.create({
                name: util.simpleTypeName('MyType'),
                fields: [{ ...util.someFieldDeclConfig, name: 'myField' }],
            }),
        )

        const fieldRef = util.isolatedFieldRef(
            util.variableRef('myVar'),
            'nonExistentField',
        )
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
                const context = util.newSemanticContext()
                context.scope.addVariableDeclaration('myVar', {
                    isImmutable,
                    isolationLevel,
                    domain: RCTypeSet.create({
                        type: util.simpleTypeName('MyType'),
                    }),
                })
                context.scope.rootScope.addDataDeclaration(
                    DataDeclaration.create({
                        name: util.simpleTypeName('MyType'),
                        fields: [
                            { ...util.someFieldDeclConfig, name: 'myField' },
                        ],
                    }),
                )

                const fieldRef = FieldReference.create({
                    object: util.variableRef('myVar'),
                    field: 'myField',
                    operator,
                    span: {
                        start: { line: 1, column: 1 },
                        end: { line: 1, column: 10 },
                    },
                    fieldSpan: util.someCodeSpan,
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
                const context = util.newSemanticContext()
                context.scope.addVariableDeclaration('myVar', {
                    isImmutable,
                    isolationLevel,
                    domain: RCTypeSet.create({
                        type: util.simpleTypeName('MyType'),
                    }),
                })
                context.scope.rootScope.addDataDeclaration(
                    DataDeclaration.create({
                        name: util.simpleTypeName('MyType'),
                        fields: [
                            {
                                ...util.someFieldDeclConfig,
                                name: 'myField',
                                isImmutable,
                            },
                        ],
                    }),
                )

                const fieldRef = util.isolatedFieldRef(
                    util.variableRef('myVar'),
                    'myField',
                )
                const result = fieldRef.isEffectivelyConst(context)
                expect(result.isSuccess && result.value).toBe(expected)
            })
        }

        it('returns true if the object is ISOLATED immutable', () => {
            const context = util.newSemanticContext()
            context.scope.addVariableDeclaration('myVar', {
                isImmutable: true,
                isolationLevel: ISOLATED,
                domain: RCTypeSet.create({
                    type: util.simpleTypeName('MyType'),
                }),
            })
            context.scope.rootScope.addDataDeclaration(
                DataDeclaration.create({
                    name: util.simpleTypeName('MyType'),
                    fields: [{ ...util.someFieldDeclConfig, name: 'myField' }],
                }),
            )

            const fieldRef = util.isolatedFieldRef(
                util.variableRef('myVar'),
                'myField',
            )
            const result = fieldRef.isEffectivelyConst(context)
            expect(result.isSuccess && result.value).toBeTrue()
        })

        it('returns true if the object is UNKNOWN immutable', () => {
            const context = util.newSemanticContext()
            context.scope.addVariableDeclaration('myVar', {
                isImmutable: true,
                isolationLevel: UNKNOWN,
                domain: RCTypeSet.create({
                    type: util.simpleTypeName('MyType'),
                }),
            })
            context.scope.rootScope.addDataDeclaration(
                DataDeclaration.create({
                    name: util.simpleTypeName('MyType'),
                    fields: [{ ...util.someFieldDeclConfig, name: 'myField' }],
                }),
            )

            const fieldRef = util.isolatedFieldRef(
                util.variableRef('myVar'),
                'myField',
            )
            const result = fieldRef.isEffectivelyConst(context)
            expect(result.isSuccess && result.value).toBeTrue()
        })

        it('returns false if the object is mutable', () => {
            const context = util.newSemanticContext()
            context.scope.addVariableDeclaration('myVar', {
                ...util.someIntegerVariable,
                domain: RCTypeSet.create({
                    type: util.simpleTypeName('MyType'),
                }),
            })
            context.scope.rootScope.addDataDeclaration(
                DataDeclaration.create({
                    name: util.simpleTypeName('MyType'),
                    fields: [{ ...util.someFieldDeclConfig, name: 'myField' }],
                }),
            )

            const fieldRef = util.isolatedFieldRef(
                util.variableRef('myVar'),
                'myField',
            )
            const result = fieldRef.isEffectivelyConst(context)
            expect(result.isSuccess).toBeTrue()
            expect(result.isSuccess && result.value).toBeFalse()
        })
    })

    describe('current value', () => {
        it('returns the declared domain (Data)', () => {
            const context = util.newSemanticContext()
            context.scope.rootScope.addDataDeclaration(
                DataDeclaration.create({
                    name: util.simpleTypeName('Data'),
                    fields: [
                        {
                            ...util.someFieldDeclConfig,
                            name: 'field',
                            domain: util.spannedDomain(
                                IntegerRange.create({ max: 100n, min: 0n }),
                            ),
                        },
                    ],
                }),
            )
            context.scope.addVariableDeclaration('myVar', {
                ...util.someIntegerVariable,
                domain: RCTypeSet.create({
                    type: TypeName.create({ name: 'Data' }),
                }),
            })

            const fieldRef = util.isolatedFieldRef(
                util.variableRef('myVar'),
                'field',
            )
            expect(fieldRef.currentValue(context)).toMatchObject({
                value: { min: 0n, max: 100n },
            })
        })

        it('returns the declared domain (Object)', () => {
            const context = util.newSemanticContext()
            context.scope.rootScope.addObjectDeclaration(
                ObjectDeclaration.create({
                    ...util.someObjectDeclConfig,
                    name: util.simpleTypeName('Object'),
                    fields: [
                        {
                            ...util.someFieldDeclConfig,
                            name: 'field',
                            domain: util.spannedDomain(
                                IntegerRange.create({ max: 100n, min: 0n }),
                            ),
                        },
                    ],
                }),
            )
            context.scope.addVariableDeclaration('myVar', {
                ...util.someIntegerVariable,
                domain: RCTypeSet.create({
                    type: TypeName.create({ name: 'Object' }),
                }),
            })

            const fieldRef = util.isolatedFieldRef(
                util.variableRef('myVar'),
                'field',
            )
            expect(fieldRef.currentValue(context)).toMatchObject({
                value: { min: 0n, max: 100n },
            })
        })
    })
})
