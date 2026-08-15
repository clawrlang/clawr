import { describe, expect, it } from 'bun:test'
import { newSemanticContext } from '../../util'
import { TypeName } from '../../../src/model/type-name'
import {
    IntegerLattice,
    RCTypeLattice,
    StringLattice,
    TruthvalueLattice,
} from '../../../src/model/lattice'

describe('Lattice', () => {
    describe('toCIR', () => {
        it('converts constrained integer to CIR correctly', () => {
            const lattice = IntegerLattice.create({
                min: 1n,
                max: 10n,
            })

            expect(lattice.toCIR()).toEqual({
                type: 'integer',
                min: '1',
                max: '10',
            })
        })

        it('converts unconstrained integer to CIR correctly', () => {
            const lattice = IntegerLattice.unconstrained()

            expect(lattice.toCIR()).toEqual({
                type: 'integer',
                min: undefined,
                max: undefined,
            })
        })

        it('converts integer with min constraint only to CIR correctly', () => {
            const lattice = IntegerLattice.create({ min: 1n })

            expect(lattice.toCIR()).toEqual({
                type: 'integer',
                min: '1',
                max: undefined,
            })
        })

        it('converts integer with max constraint only to CIR correctly', () => {
            const lattice = IntegerLattice.create({ max: 10n })

            expect(lattice.toCIR()).toEqual({
                type: 'integer',
                min: undefined,
                max: '10',
            })
        })

        it('converts truthvalue to CIR correctly', () => {
            const lattice = TruthvalueLattice.create(['true', 'false'])

            expect(lattice.toCIR()).toEqual({
                type: 'truthvalue',
                values: ['true', 'false'],
            })
        })

        it('converts unconstrained truthvalue to CIR correctly', () => {
            const lattice = TruthvalueLattice.unconstrained()

            expect(lattice.toCIR()).toEqual({
                type: 'truthvalue',
                values: ['false', 'ambiguous', 'true'],
            })
        })

        it('converts string to CIR correctly', () => {
            const valueSet = StringLattice.create()

            expect(valueSet.toCIR()).toEqual({ type: 'string' })
        })

        it('converts rc-type to CIR correctly', () => {
            const lattice = RCTypeLattice.create({
                type: TypeName.create({ name: 'MyType' }),
            })

            expect(lattice.toCIR()).toEqual({
                type: 'rc-type',
                typeName: 'MyType',
            })
        })
    })
})
