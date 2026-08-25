import { describe, expect, it } from 'bun:test'
import { newSemanticContext, someCodeSpan } from '../../util'
import { TruthValueLiteral } from '../../../src/model/truthvalue-literal'
import { IntegerLiteral } from '../../../src/model/integer-literal'
import { DataLiteral } from '../../../src/model/data-literal'
import { DataDeclaration } from '../../../src/model/data-declaration'
import { TypeName } from '../../../src/model/type-name'
import { ISOLATED, SHARED } from '../../../src/model/isolation-level'
import {
    IntegerLattice,
    RCTypeLattice,
    truthvalue,
} from '../../../src/model/lattice'
import { decorateLattice } from '../../../src/model/lattice-declaration'
import { Failable } from '../../../src/model/gen-failable'
import { _Failable } from '../../../src/model/failable'

describe('Literals', () => {
    describe('truthvalue literals', () => {
        const cases: truthvalue[] = ['true', 'false', 'ambiguous'] as const
        for (const input of cases) {
            it(`outputs ${input} as TRUTHVALUE_LITERAL`, () => {
                const literal = TruthValueLiteral.create({
                    value: input,
                    span: someCodeSpan,
                })
                expect(
                    _Failable
                        .of(
                            Failable.do(() =>
                                literal.toCIRExpression(newSemanticContext()),
                            ),
                        )
                        .value(),
                ).toMatchObject({
                    kind: 'TRUTHVALUE_LITERAL',
                    value: { values: [input] },
                })
            })

            it('has a current value set of the literal value', () => {
                const literal = TruthValueLiteral.create({
                    value: input,
                    span: someCodeSpan,
                })
                expect(
                    _Failable
                        .of(
                            Failable.do(() =>
                                literal.currentValue(newSemanticContext()),
                            ),
                        )
                        .value(),
                ).toMatchObject({
                    values: [input],
                })
            })
        }
    })

    describe('integer literals', () => {
        const cases = ['0', '1', '2', '-1', '123456789'] as const
        for (const input of cases) {
            it(`outputs ${input} as INTEGER_LITERAL`, () => {
                const literal = IntegerLiteral.create({
                    value: BigInt(input),
                    span: someCodeSpan,
                })
                expect(
                    _Failable
                        .of(
                            Failable.do(() =>
                                literal.toCIRExpression(newSemanticContext()),
                            ),
                        )
                        .value(),
                ).toMatchObject({
                    kind: 'INTEGER_LITERAL',
                    value: { max: input, min: input },
                })
            })

            it('has a current value set of the literal value', () => {
                const literal = IntegerLiteral.create({
                    value: BigInt(input),
                    span: someCodeSpan,
                })
                expect(
                    _Failable
                        .of(
                            Failable.do(() =>
                                literal.currentValue(newSemanticContext()),
                            ),
                        )
                        .value(),
                ).toMatchObject({
                    min: BigInt(input),
                    max: BigInt(input),
                })
            })
        }
    })

    describe('data literals', () => {
        it('outputs a data literal as ALLOCATE', () => {
            const context = newSemanticContext()
            context.scope.rootScope.addDataDeclaration(
                DataDeclaration.create({
                    name: TypeName.create({ name: 'MyType' }),
                    fields: [
                        {
                            name: 'x',
                            isImmutable: false,
                            isolationLevel: ISOLATED,
                            lattice: decorateLattice(
                                IntegerLattice.unconstrained(),
                                { span: someCodeSpan },
                            ),
                        },
                        {
                            name: 'y',
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

            const dataLiteral = DataLiteral.create({
                fields: [
                    {
                        name: 'x',
                        value: IntegerLiteral.create({
                            value: 42n,
                            span: someCodeSpan,
                        }),
                    },
                    {
                        name: 'y',
                        value: IntegerLiteral.create({
                            value: 17n,
                            span: someCodeSpan,
                        }),
                    },
                ],
                span: someCodeSpan,
            })

            expect(
                _Failable
                    .of(
                        Failable.do(() =>
                            dataLiteral.toCIRExpression({
                                ...context,
                                explicitLattice: RCTypeLattice.create({
                                    type: TypeName.create({ name: 'MyType' }),
                                }),
                                isolationLevel: SHARED,
                            }),
                        ),
                    )
                    .value(),
            ).toMatchObject({
                kind: 'ALLOCATION',
                fields: [
                    {
                        name: 'x',
                        value: {
                            kind: 'INTEGER_LITERAL',
                            value: { max: '42', min: '42' },
                        },
                    },
                    {
                        name: 'y',
                        value: {
                            kind: 'INTEGER_LITERAL',
                            value: { max: '17', min: '17' },
                        },
                    },
                ],
            })
        })

        it('has a current value set of the literal value', () => {
            const context = newSemanticContext()
            context.scope.rootScope.addDataDeclaration(
                DataDeclaration.create({
                    name: TypeName.create({ name: 'MyType' }),
                    fields: [
                        {
                            name: 'x',
                            isImmutable: false,
                            isolationLevel: ISOLATED,
                            lattice: decorateLattice(
                                IntegerLattice.unconstrained(),
                                { span: someCodeSpan },
                            ),
                        },
                        {
                            name: 'y',
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

            const dataLiteral = DataLiteral.create({
                fields: [
                    {
                        name: 'x',
                        value: IntegerLiteral.create({
                            value: 42n,
                            span: someCodeSpan,
                        }),
                    },
                    {
                        name: 'y',
                        value: IntegerLiteral.create({
                            value: 17n,
                            span: someCodeSpan,
                        }),
                    },
                ],
                span: someCodeSpan,
            })

            expect(
                _Failable
                    .of(
                        Failable.do(() =>
                            dataLiteral.currentValue({
                                ...context,
                                explicitLattice: RCTypeLattice.create({
                                    type: TypeName.create({ name: 'MyType' }),
                                }),
                            }),
                        ),
                    )
                    .value(),
            ).toMatchObject({
                type: { name: 'MyType' },
                fields: {
                    x: { min: 42n, max: 42n },
                    y: { min: 17n, max: 17n },
                },
            })
        })

        it('returns a failure from a nested field value', () => {
            const context = newSemanticContext()
            context.scope.rootScope.addDataDeclaration(
                DataDeclaration.create({
                    name: TypeName.create({ name: 'OuterType' }),
                    fields: [
                        {
                            name: 'inner',
                            isImmutable: false,
                            isolationLevel: ISOLATED,
                            lattice: decorateLattice(
                                RCTypeLattice.create({
                                    type: TypeName.create({
                                        name: 'MissingInnerType',
                                    }),
                                }),
                                { span: someCodeSpan },
                            ),
                        },
                    ],
                }),
            )

            const dataLiteral = DataLiteral.create({
                fields: [
                    {
                        name: 'inner',
                        value: DataLiteral.create({
                            fields: [
                                {
                                    name: 'value',
                                    value: IntegerLiteral.create({
                                        value: 7n,
                                        span: someCodeSpan,
                                    }),
                                },
                            ],
                            span: someCodeSpan,
                        }),
                    },
                ],
                span: someCodeSpan,
            })

            expect(
                _Failable
                    .of(
                        Failable.do(() =>
                            dataLiteral.currentValue({
                                ...context,
                                explicitLattice: RCTypeLattice.create({
                                    type: TypeName.create({
                                        name: 'OuterType',
                                    }),
                                }),
                            }),
                        ),
                    )
                    .isFailure(),
            ).toBe(true)
        })
    })
})
