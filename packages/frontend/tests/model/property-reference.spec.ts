import { DataDeclaration } from '@/model/data-declaration'
import { ISOLATED, SHARED, UNKNOWN } from '@/model/isolation-level'
import { ObjectDeclaration } from '@/model/object-declaration'
import { PropertyReference } from '@/model/property-reference'
import { TypeName } from '@/model/type-name'
import { IntegerSet, RCTypeSet } from '@/model/value-set'
import { SemanticResult } from '@/tools/source-result'
import * as util from '@@/util'
import { describe, expect, it, test } from 'bun:test'

describe('Property Reference', () => {
    it('infers its type from the context', () => {
        const context = util.newSemanticContext()
        context.scope.addVariableDeclaration('myVar', {
            ...util.someIntegerVariable,
            type: RCTypeSet.create({
                type: util.simpleTypeName('MyType'),
            }),
        })
        context.scope.rootScope.addDataDeclaration(
            DataDeclaration.create({
                name: util.simpleTypeName('MyType'),
                properties: [
                    { ...util.somePropertyDeclConfig, name: 'myProperty' },
                ],
            }),
        )

        const propertyRef = util.isolatedPropertyRef(
            util.variableRef('myVar'),
            'myProperty',
        )
        const result = propertyRef.type(context)
        expect(result.isSuccess && result.value.toCIR().universe).toBe(
            'integer',
        )
    })

    it('infers its isolation level from the context', () => {
        const context = util.newSemanticContext()
        context.scope.addVariableDeclaration('myVar', {
            ...util.someIntegerVariable,
            type: RCTypeSet.create({
                type: util.simpleTypeName('MyType'),
            }),
        })
        context.scope.rootScope.addDataDeclaration(
            DataDeclaration.create({
                name: util.simpleTypeName('MyType'),
                properties: [
                    {
                        isImmutable: true,
                        name: 'myProperty',
                        isolationLevel: SHARED,
                        type: util.spannedTypeConstraint(
                            RCTypeSet.create({
                                type: util.simpleTypeName('MyType'),
                            }),
                        ),
                    },
                ],
            }),
        )

        const propertyRef = util.isolatedPropertyRef(
            util.variableRef('myVar'),
            'myProperty',
        )
        const result = propertyRef.isolationLevel(context)
        expect(result.isSuccess && result.value).toEqual(SHARED)
    })

    describe('infers its type and isolation level from the context', () => {
        const cases = [
            {
                isImmutable: true,
                expected: ISOLATED,
            },
            {
                isImmutable: false,
                expected: ISOLATED,
            },
            {
                isImmutable: true,
                expected: SHARED,
            },
            {
                isImmutable: false,
                expected: SHARED,
            },
        ] as const

        for (const { isImmutable, expected } of cases)
            test(`${isImmutable ? 'immutable' : 'mutable'} ${expected} object`, () => {
                const context = util.newSemanticContext()
                context.scope.addVariableDeclaration('myVar', {
                    isImmutable,
                    isolationLevel: expected,
                    type: RCTypeSet.create({
                        type: util.simpleTypeName('MyType'),
                    }),
                })
                context.scope.rootScope.addDataDeclaration(
                    DataDeclaration.create({
                        name: util.simpleTypeName('InnerType'),
                        properties: [],
                    }),
                )
                context.scope.rootScope.addDataDeclaration(
                    DataDeclaration.create({
                        name: util.simpleTypeName('MyType'),
                        properties: [
                            {
                                isImmutable,
                                name: 'myProperty',
                                isolationLevel: expected,
                                type: util.spannedTypeConstraint(
                                    RCTypeSet.create({
                                        type: util.simpleTypeName('InnerType'),
                                    }),
                                ),
                            },
                        ],
                    }),
                )

                const propertyRef =
                    expected === SHARED
                        ? util.sharedPropertyRef(
                              util.variableRef('myVar'),
                              'myProperty',
                          )
                        : util.isolatedPropertyRef(
                              util.variableRef('myVar'),
                              'myProperty',
                          )
                const result = SemanticResult.collect([
                    propertyRef.isolationLevel(context),
                    propertyRef.type(context),
                ])

                expect(result.isSuccess && result.value).toMatchObject([
                    expected,
                    { type: { name: 'InnerType' } },
                ])
            })
    })

    it('throws if the property does not exist on the type', () => {
        const context = util.newSemanticContext()
        context.scope.addVariableDeclaration('myVar', {
            ...util.someIntegerVariable,
            type: RCTypeSet.create({
                type: util.simpleTypeName('MyType'),
            }),
        })
        context.scope.rootScope.addDataDeclaration(
            DataDeclaration.create({
                name: util.simpleTypeName('MyType'),
                properties: [
                    { ...util.somePropertyDeclConfig, name: 'myProperty' },
                ],
            }),
        )

        const propertyRef = util.isolatedPropertyRef(
            util.variableRef('myVar'),
            'nonExistentProperty',
        )
        const result = propertyRef.toCIRExpression(context)
        expect(
            result.isError && result.error.errors.map((e) => e.message),
        ).toContain(
            'Property nonExistentProperty does not exist on type MyType',
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
                const context = util.newSemanticContext()
                context.scope.addVariableDeclaration('myVar', {
                    isImmutable,
                    isolationLevel,
                    type: RCTypeSet.create({
                        type: util.simpleTypeName('MyType'),
                    }),
                })
                context.scope.rootScope.addDataDeclaration(
                    DataDeclaration.create({
                        name: util.simpleTypeName('MyType'),
                        properties: [
                            {
                                ...util.somePropertyDeclConfig,
                                name: 'myProperty',
                            },
                        ],
                    }),
                )

                const propertyRef = PropertyReference.create({
                    object: util.variableRef('myVar'),
                    property: 'myProperty',
                    operator,
                    span: {
                        start: { line: 1, column: 1 },
                        end: { line: 1, column: 10 },
                    },
                    propertySpan: util.someCodeSpan,
                })
                const result = propertyRef.toCIRExpression(context)
                expect(result.isError && result.error.errors[0]).toMatchObject({
                    message: `Cannot access property myProperty of a ${isolationLevel} type object with "${operator}" operator`,
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
                    type: RCTypeSet.create({
                        type: util.simpleTypeName('MyType'),
                    }),
                })
                context.scope.rootScope.addDataDeclaration(
                    DataDeclaration.create({
                        name: util.simpleTypeName('MyType'),
                        properties: [
                            {
                                ...util.somePropertyDeclConfig,
                                name: 'myProperty',
                                isImmutable,
                            },
                        ],
                    }),
                )

                const propertyRef = util.isolatedPropertyRef(
                    util.variableRef('myVar'),
                    'myProperty',
                )
                const result = propertyRef.isEffectivelyConst(context)
                expect(result.isSuccess && result.value).toBe(expected)
            })
        }

        it('returns true if the object is ISOLATED immutable', () => {
            const context = util.newSemanticContext()
            context.scope.addVariableDeclaration('myVar', {
                isImmutable: true,
                isolationLevel: ISOLATED,
                type: RCTypeSet.create({
                    type: util.simpleTypeName('MyType'),
                }),
            })
            context.scope.rootScope.addDataDeclaration(
                DataDeclaration.create({
                    name: util.simpleTypeName('MyType'),
                    properties: [
                        { ...util.somePropertyDeclConfig, name: 'myProperty' },
                    ],
                }),
            )

            const propertyRef = util.isolatedPropertyRef(
                util.variableRef('myVar'),
                'myProperty',
            )
            const result = propertyRef.isEffectivelyConst(context)
            expect(result.isSuccess && result.value).toBeTrue()
        })

        it('returns true if the object is UNKNOWN immutable', () => {
            const context = util.newSemanticContext()
            context.scope.addVariableDeclaration('myVar', {
                isImmutable: true,
                isolationLevel: UNKNOWN,
                type: RCTypeSet.create({
                    type: util.simpleTypeName('MyType'),
                }),
            })
            context.scope.rootScope.addDataDeclaration(
                DataDeclaration.create({
                    name: util.simpleTypeName('MyType'),
                    properties: [
                        { ...util.somePropertyDeclConfig, name: 'myProperty' },
                    ],
                }),
            )

            const propertyRef = util.isolatedPropertyRef(
                util.variableRef('myVar'),
                'myProperty',
            )
            const result = propertyRef.isEffectivelyConst(context)
            expect(result.isSuccess && result.value).toBeTrue()
        })

        it('returns false if the object is mutable', () => {
            const context = util.newSemanticContext()
            context.scope.addVariableDeclaration('myVar', {
                ...util.someIntegerVariable,
                type: RCTypeSet.create({
                    type: util.simpleTypeName('MyType'),
                }),
            })
            context.scope.rootScope.addDataDeclaration(
                DataDeclaration.create({
                    name: util.simpleTypeName('MyType'),
                    properties: [
                        { ...util.somePropertyDeclConfig, name: 'myProperty' },
                    ],
                }),
            )

            const propertyRef = util.isolatedPropertyRef(
                util.variableRef('myVar'),
                'myProperty',
            )
            const result = propertyRef.isEffectivelyConst(context)
            expect(result.isSuccess).toBeTrue()
            expect(result.isSuccess && result.value).toBeFalse()
        })
    })

    describe('current value', () => {
        it('returns the declared type (Data)', () => {
            const context = util.newSemanticContext()
            context.scope.rootScope.addDataDeclaration(
                DataDeclaration.create({
                    name: util.simpleTypeName('Data'),
                    properties: [
                        {
                            ...util.somePropertyDeclConfig,
                            name: 'property',
                            type: util.spannedTypeConstraint(
                                IntegerSet.range({ max: 100n, min: 0n }),
                            ),
                        },
                    ],
                }),
            )
            context.scope.addVariableDeclaration('myVar', {
                ...util.someIntegerVariable,
                type: RCTypeSet.create({
                    type: TypeName.create({ name: 'Data' }),
                }),
            })

            const propertyRef = util.isolatedPropertyRef(
                util.variableRef('myVar'),
                'property',
            )
            expect(propertyRef.currentValue(context)).toMatchObject({
                value: { min: 0n, max: 100n },
            })
        })

        it('returns the declared type (Object)', () => {
            const context = util.newSemanticContext()
            context.scope.rootScope.addObjectDeclaration(
                ObjectDeclaration.create({
                    ...util.someObjectDeclConfig,
                    name: util.simpleTypeName('Object'),
                    properties: [
                        {
                            ...util.somePropertyDeclConfig,
                            name: 'property',
                            type: util.spannedTypeConstraint(
                                IntegerSet.range({ max: 100n, min: 0n }),
                            ),
                        },
                    ],
                }),
            )
            context.scope.addVariableDeclaration('myVar', {
                ...util.someIntegerVariable,
                type: RCTypeSet.create({
                    type: TypeName.create({ name: 'Object' }),
                }),
            })

            const propertyRef = util.isolatedPropertyRef(
                util.variableRef('myVar'),
                'property',
            )
            expect(propertyRef.currentValue(context)).toMatchObject({
                value: { min: 0n, max: 100n },
            })
        })
    })
})
