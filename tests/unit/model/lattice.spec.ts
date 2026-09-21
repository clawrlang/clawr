import { TypeName } from '@/model/type-name'
import {
    IntegerRange,
    RCTypeSet,
    StringSet,
    TruthvalueSet,
} from '@/model/value-set'
import { describe, expect, it } from 'bun:test'

describe('ValueSet', () => {
    describe('toCIR', () => {
        it('converts constrained integer to CIR correctly', () => {
            const valueSet = IntegerRange.create({
                min: 1n,
                max: 10n,
            })

            expect(valueSet.toCIR()).toEqual({
                type: 'integer',
                min: '1',
                max: '10',
            })
        })

        it('converts unconstrained integer to CIR correctly', () => {
            const valueSet = IntegerRange.unconstrained()

            expect(valueSet.toCIR()).toEqual({
                type: 'integer',
                min: undefined,
                max: undefined,
            })
        })

        it('converts integer with min constraint only to CIR correctly', () => {
            const valueSet = IntegerRange.create({ min: 1n })

            expect(valueSet.toCIR()).toEqual({
                type: 'integer',
                min: '1',
                max: undefined,
            })
        })

        it('converts integer with max constraint only to CIR correctly', () => {
            const valueSet = IntegerRange.create({ max: 10n })

            expect(valueSet.toCIR()).toEqual({
                type: 'integer',
                min: undefined,
                max: '10',
            })
        })

        it('converts truthvalue to CIR correctly', () => {
            const valueSet = TruthvalueSet.create(['true', 'false'])

            expect(valueSet.toCIR()).toEqual({
                type: 'truthvalue',
                values: ['true', 'false'],
            })
        })

        it('converts unconstrained truthvalue to CIR correctly', () => {
            const valueSet = TruthvalueSet.unconstrained()

            expect(valueSet.toCIR()).toEqual({
                type: 'truthvalue',
                values: ['false', 'ambiguous', 'true'],
            })
        })

        it('converts string to CIR correctly', () => {
            const valueSet = StringSet.create()

            expect(valueSet.toCIR()).toEqual({ type: 'string' })
        })

        it('converts rc-type to CIR correctly', () => {
            const valueSet = RCTypeSet.create({
                type: TypeName.create({ name: 'MyType' }),
            })

            expect(valueSet.toCIR()).toEqual({
                type: 'rc-type',
                name: 'MyType',
            })
        })
    })
})
