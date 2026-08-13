import { describe, expect, it } from 'bun:test'
import {
    ExplicitIntegerValueSet,
    ExplicitRCTypeValueSet,
    ExplicitStringValueSet,
    ExplicitTruthValueSet,
} from '../../../src/model/explicit-value-set'
import { newSemanticContext } from '../../util'
import { TypeName } from '../../../src/model/type-name'

describe('ExplicitValueSet', () => {
    describe('toCIR', () => {
        it('converts constrained integer to CIR correctly', () => {
            const valueSet = ExplicitIntegerValueSet.create({
                min: 1n,
                max: 10n,
                span: {
                    start: { line: 1, column: 1 },
                    end: { line: 1, column: 15 },
                },
            })

            expect(valueSet.toCIR()).toEqual({
                type: 'integer',
                min: '1',
                max: '10',
            })
        })

        it('converts unconstrained integer to CIR correctly', () => {
            const valueSet = ExplicitIntegerValueSet.create({
                span: {
                    start: { line: 1, column: 1 },
                    end: { line: 1, column: 8 },
                },
            })

            expect(valueSet.toCIR()).toEqual({
                type: 'integer',
                min: undefined,
                max: undefined,
            })
        })

        it('converts integer with min constraint only to CIR correctly', () => {
            const valueSet = ExplicitIntegerValueSet.create({
                min: 1n,
                span: {
                    start: { line: 1, column: 1 },
                    end: { line: 1, column: 14 },
                },
            })

            expect(valueSet.toCIR()).toEqual({
                type: 'integer',
                min: '1',
                max: undefined,
            })
        })

        it('converts integer with max constraint only to CIR correctly', () => {
            const valueSet = ExplicitIntegerValueSet.create({
                max: 10n,
                span: {
                    start: { line: 1, column: 1 },
                    end: { line: 1, column: 15 },
                },
            })

            expect(valueSet.toCIR()).toEqual({
                type: 'integer',
                min: undefined,
                max: '10',
            })
        })

        it('converts truthvalue to CIR correctly', () => {
            const valueSet = ExplicitTruthValueSet.create({
                values: ['true', 'false'],
                span: {
                    start: { line: 1, column: 1 },
                    end: { line: 1, column: 20 },
                },
            })

            expect(valueSet.toCIR()).toEqual({
                type: 'truthvalue',
                values: ['true', 'false'],
            })
        })

        it('converts unconstrained truthvalue to CIR correctly', () => {
            const valueSet = ExplicitTruthValueSet.create({
                span: {
                    start: { line: 1, column: 1 },
                    end: { line: 1, column: 11 },
                },
            })

            expect(valueSet.toCIR()).toEqual({
                type: 'truthvalue',
                values: ['false', 'ambiguous', 'true'],
            })
        })

        it('converts string to CIR correctly', () => {
            const valueSet = ExplicitStringValueSet.create({
                span: {
                    start: { line: 1, column: 1 },
                    end: { line: 1, column: 7 },
                },
            })

            expect(valueSet.toCIR()).toEqual({
                type: 'string',
            })
        })

        it('converts ISOLATED rc-type to CIR correctly', () => {
            const valueSet = ExplicitRCTypeValueSet.create({
                type: TypeName.create({ name: 'MyType' }),
                span: {
                    start: { line: 1, column: 1 },
                    end: { line: 1, column: 7 },
                },
            })

            expect(valueSet.toCIR()).toEqual({
                type: 'rc-type',
                typeName: 'MyType',
            })
        })

        it('converts SHARED rc-type to CIR correctly', () => {
            const valueSet = ExplicitRCTypeValueSet.create({
                type: TypeName.create({ name: 'MyType' }),
                span: {
                    start: { line: 1, column: 1 },
                    end: { line: 1, column: 7 },
                },
            })

            expect(valueSet.toCIR()).toEqual({
                type: 'rc-type',
                typeName: 'MyType',
            })
        })
    })

    describe('toLattice', () => {
        it('converts integer to lattice correctly', () => {
            const valueSet = ExplicitIntegerValueSet.create({
                min: 1n,
                max: 10n,
                span: {
                    start: { line: 1, column: 1 },
                    end: { line: 1, column: 15 },
                },
            })

            expect(valueSet.toLattice()).toEqual(
                expect.objectContaining({
                    min: 1n,
                    max: 10n,
                }),
            )
        })

        it('converts truthvalue to lattice correctly', () => {
            const valueSet = ExplicitTruthValueSet.create({
                values: ['true', 'false'],
                span: {
                    start: { line: 1, column: 1 },
                    end: { line: 1, column: 20 },
                },
            })

            expect(valueSet.toLattice()).toEqual(
                expect.objectContaining({
                    values: ['true', 'false'],
                }),
            )
        })

        it('converts string to lattice correctly', () => {
            const valueSet = ExplicitStringValueSet.create({
                span: {
                    start: { line: 1, column: 1 },
                    end: { line: 1, column: 7 },
                },
            })

            expect(valueSet.toLattice()).toEqual(expect.objectContaining({}))
        })

        it('converts ISOLATED rc-type to lattice correctly', () => {
            const valueSet = ExplicitRCTypeValueSet.create({
                type: TypeName.create({ name: 'MyType' }),
                span: {
                    start: { line: 1, column: 1 },
                    end: { line: 1, column: 7 },
                },
            })

            expect(valueSet.toLattice(newSemanticContext())).toMatchObject({
                type: { name: 'MyType' },
                fields: {},
            })
        })

        it('converts SHARED rc-type to lattice correctly', () => {
            const valueSet = ExplicitRCTypeValueSet.create({
                type: TypeName.create({ name: 'MyType' }),
                span: {
                    start: { line: 1, column: 1 },
                    end: { line: 1, column: 7 },
                },
            })

            expect(valueSet.toLattice(newSemanticContext())).toMatchObject({
                type: { name: 'MyType' },
            })
        })
    })
})
