import { describe, expect, it } from 'bun:test'
import {
    IntegerValueSet,
    RCTypeValueSet,
    StringValueSet,
    TruthValueSet,
} from '../../../src/model/value-set'
import { newSemanticContext } from '../../util'

describe('ValueSet', () => {
    describe('toCIR', () => {
        it('converts constrained integer to CIR correctly', () => {
            const valueSet = IntegerValueSet.create({
                min: 1n,
                max: 10n,
                span: {
                    start: { line: 1, column: 1 },
                    end: { line: 1, column: 15 },
                },
            })

            expect(valueSet.toCIR({ semantics: 'COW' })).toEqual({
                type: 'integer',
                min: '1',
                max: '10',
            })
        })

        it('converts unconstrained integer to CIR correctly', () => {
            const valueSet = IntegerValueSet.create({
                span: {
                    start: { line: 1, column: 1 },
                    end: { line: 1, column: 8 },
                },
            })

            expect(valueSet.toCIR({ semantics: 'COW' })).toEqual({
                type: 'integer',
                min: undefined,
                max: undefined,
            })
        })

        it('converts integer with min constraint only to CIR correctly', () => {
            const valueSet = IntegerValueSet.create({
                min: 1n,
                span: {
                    start: { line: 1, column: 1 },
                    end: { line: 1, column: 14 },
                },
            })

            expect(valueSet.toCIR({ semantics: 'COW' })).toEqual({
                type: 'integer',
                min: '1',
                max: undefined,
            })
        })

        it('converts integer with max constraint only to CIR correctly', () => {
            const valueSet = IntegerValueSet.create({
                max: 10n,
                span: {
                    start: { line: 1, column: 1 },
                    end: { line: 1, column: 15 },
                },
            })

            expect(valueSet.toCIR({ semantics: 'COW' })).toEqual({
                type: 'integer',
                min: undefined,
                max: '10',
            })
        })

        it('converts truthvalue to CIR correctly', () => {
            const valueSet = TruthValueSet.create({
                values: ['true', 'false'],
                span: {
                    start: { line: 1, column: 1 },
                    end: { line: 1, column: 20 },
                },
            })

            expect(valueSet.toCIR({ semantics: 'COW' })).toEqual({
                type: 'truthvalue',
                values: ['true', 'false'],
            })
        })

        it('converts unconstrained truthvalue to CIR correctly', () => {
            const valueSet = TruthValueSet.create({
                span: {
                    start: { line: 1, column: 1 },
                    end: { line: 1, column: 11 },
                },
            })

            expect(valueSet.toCIR({ semantics: 'COW' })).toEqual({
                type: 'truthvalue',
                values: ['false', 'ambiguous', 'true'],
            })
        })

        it('converts string to CIR correctly', () => {
            const valueSet = StringValueSet.create({
                span: {
                    start: { line: 1, column: 1 },
                    end: { line: 1, column: 7 },
                },
            })

            expect(valueSet.toCIR({ semantics: 'COW' })).toEqual({
                type: 'string',
            })
        })

        it('converts COW rc-type to CIR correctly', () => {
            const valueSet = RCTypeValueSet.create({
                typeName: 'MyType',
                semantics: 'mut',
                span: {
                    start: { line: 1, column: 1 },
                    end: { line: 1, column: 7 },
                },
            })

            expect(valueSet.toCIR(null!)).toEqual({
                type: 'rc-type',
                typeName: 'MyType',
                semantics: 'COW',
            })
        })

        it('converts REF rc-type to CIR correctly', () => {
            const valueSet = RCTypeValueSet.create({
                typeName: 'MyType',
                semantics: 'ref',
                span: {
                    start: { line: 1, column: 1 },
                    end: { line: 1, column: 7 },
                },
            })

            expect(valueSet.toCIR({ semantics: 'REF' })).toEqual({
                type: 'rc-type',
                typeName: 'MyType',
                semantics: 'REF',
            })
        })
    })

    describe('toLattice', () => {
        it('converts integer to lattice correctly', () => {
            const valueSet = IntegerValueSet.create({
                min: 1n,
                max: 10n,
                span: {
                    start: { line: 1, column: 1 },
                    end: { line: 1, column: 15 },
                },
            })

            expect(valueSet.toLattice({} as any)).toEqual(
                expect.objectContaining({
                    min: 1n,
                    max: 10n,
                }),
            )
        })

        it('converts truthvalue to lattice correctly', () => {
            const valueSet = TruthValueSet.create({
                values: ['true', 'false'],
                span: {
                    start: { line: 1, column: 1 },
                    end: { line: 1, column: 20 },
                },
            })

            expect(valueSet.toLattice({} as any)).toEqual(
                expect.objectContaining({
                    values: ['true', 'false'],
                }),
            )
        })

        it('converts string to lattice correctly', () => {
            const valueSet = StringValueSet.create({
                span: {
                    start: { line: 1, column: 1 },
                    end: { line: 1, column: 7 },
                },
            })

            expect(valueSet.toLattice({} as any)).toEqual(
                expect.objectContaining({}),
            )
        })

        it('converts COW rc-type to lattice correctly', () => {
            const valueSet = RCTypeValueSet.create({
                typeName: 'MyType',
                semantics: 'mut',
                span: {
                    start: { line: 1, column: 1 },
                    end: { line: 1, column: 7 },
                },
            })

            expect(
                valueSet.toLattice({
                    ...newSemanticContext(),
                    semantics: 'COW',
                }),
            ).toMatchObject({
                typeName: 'MyType',
                fields: {},
            })
        })

        it('converts REF rc-type to lattice correctly', () => {
            const valueSet = RCTypeValueSet.create({
                typeName: 'MyType',
                semantics: 'ref',
                span: {
                    start: { line: 1, column: 1 },
                    end: { line: 1, column: 7 },
                },
            })

            expect(
                valueSet.toLattice({
                    ...newSemanticContext(),
                    semantics: 'REF',
                }),
            ).toMatchObject({
                typeName: 'MyType',
            })
        })
    })
})
