import {
    IntegerSet,
    RCTypeSet,
    RealSet,
    StringSet,
    TruthvalueSet,
} from '@/model/value-set'
import { simpleTypeName } from '@@/util'
import { describe, expect, it } from 'bun:test'
import { decimal } from 'decimalish'

describe('ValueSet', () => {
    describe('toCIR', () => {
        it('converts constrained integer to CIR correctly', () => {
            const valueSet = IntegerSet.range({
                min: 1n,
                max: 10n,
            })

            expect(valueSet.toCIR()).toEqual({
                universe: 'integer',
                min: '1',
                max: '10',
            })
        })

        it('converts unconstrained integer to CIR correctly', () => {
            const valueSet = IntegerSet.unconstrained()

            expect(valueSet.toCIR()).toEqual({
                universe: 'integer',
                min: undefined,
                max: undefined,
            })
        })

        it('converts integer with min constraint only to CIR correctly', () => {
            const valueSet = IntegerSet.range({ min: 1n })

            expect(valueSet.toCIR()).toEqual({
                universe: 'integer',
                min: '1',
                max: undefined,
            })
        })

        it('converts integer with max constraint only to CIR correctly', () => {
            const valueSet = IntegerSet.range({ max: 10n })

            expect(valueSet.toCIR()).toEqual({
                universe: 'integer',
                min: undefined,
                max: '10',
            })
        })

        it('converts constrained real to CIR correctly', () => {
            const valueSet = RealSet.range({
                min: decimal(1),
                max: decimal(10),
            })

            expect(valueSet.toCIR()).toEqual({
                universe: 'real',
                min: '1',
                max: '10',
            })
        })

        it('converts unconstrained real to CIR correctly', () => {
            const valueSet = RealSet.unconstrained()

            expect(valueSet.toCIR()).toEqual({
                universe: 'real',
                min: undefined,
                max: undefined,
            })
        })

        it('converts real with min constraint only to CIR correctly', () => {
            const valueSet = RealSet.range({ min: decimal(1) })

            expect(valueSet.toCIR()).toMatchObject({
                universe: 'real',
                min: '1',
                max: undefined,
            })
        })

        it('converts real with max constraint only to CIR correctly', () => {
            const valueSet = RealSet.range({ max: decimal(10) })

            expect(valueSet.toCIR()).toMatchObject({
                universe: 'real',
                min: undefined,
                max: '10',
            })
        })

        it('converts truthvalue to CIR correctly', () => {
            const valueSet = TruthvalueSet.create(['true', 'false'])

            expect(valueSet.toCIR()).toEqual({
                universe: 'truthvalue',
                values: ['false', 'true'],
            })
        })

        it('converts unconstrained truthvalue to CIR correctly', () => {
            const valueSet = TruthvalueSet.unconstrained()

            expect(valueSet.toCIR()).toEqual({ universe: 'truthvalue' })
        })

        it('converts string to CIR correctly', () => {
            const valueSet = StringSet.create()

            expect(valueSet.toCIR()).toEqual({ universe: 'string' })
        })

        it('converts rc-type to CIR correctly', () => {
            const valueSet = RCTypeSet.create({
                type: simpleTypeName('MyType'),
            })

            expect(valueSet.toCIR()).toEqual({
                universe: 'rc-type',
                name: 'MyType',
            })
        })
    })
})
