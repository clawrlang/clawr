import { ISOLATED } from '@/model/isolation-level'
import { IntegerLattice } from '@/model/lattice'
import { Scope } from '@/model/scope'
import { describe, expect, it } from 'bun:test'

describe('Scope', () => {
    describe('variables in current scope', () => {
        it('defaults to the entire lattice', () => {
            const scope = Scope.createRoot()
            scope.addVariableDeclaration('v', {
                isImmutable: false,
                isolationLevel: ISOLATED,
                lattice: IntegerLattice.unconstrained(),
            })

            expect(scope.currentValue('v')).toMatchObject({
                min: undefined,
                max: undefined,
            })
        })

        it('can set a smaller lattice', () => {
            const scope = Scope.createRoot()
            scope.addVariableDeclaration('v', {
                isImmutable: false,
                isolationLevel: ISOLATED,
                lattice: IntegerLattice.unconstrained(),
            })

            expect(
                scope.setCurrentValue('v', IntegerLattice.singleton(12n))
                    .isSuccess,
            ).toBeTrue()

            expect(scope.currentValue('v')).toMatchObject({
                min: 12n,
                max: 12n,
            })
        })

        it('finds the value in the parent scope', () => {
            const parent = Scope.createRoot()
            parent.addVariableDeclaration('v', {
                isImmutable: false,
                isolationLevel: ISOLATED,
                lattice: IntegerLattice.unconstrained(),
            })

            expect(
                parent.setCurrentValue('v', IntegerLattice.singleton(12n))
                    .isSuccess,
            ).toBeTrue()

            const scope = parent.createChildScope()
            expect(scope.currentValue('v')).toMatchObject({
                min: 12n,
                max: 12n,
            })
        })

        it('shadows the parent scope', () => {
            const parent = Scope.createRoot()
            parent.addVariableDeclaration('v', {
                isImmutable: false,
                isolationLevel: ISOLATED,
                lattice: IntegerLattice.unconstrained(),
            })

            expect(
                parent.setCurrentValue('v', IntegerLattice.singleton(12n))
                    .isSuccess,
            ).toBeTrue()

            const scope = parent.createChildScope()
            scope.addVariableDeclaration('v', {
                isImmutable: false,
                isolationLevel: ISOLATED,
                lattice: IntegerLattice.unconstrained(),
            })
            expect(scope.currentValue('v')).toMatchObject({
                min: undefined,
                max: undefined,
            })
        })

        it('fails if setting a wider lattice', () => {
            const scope = Scope.createRoot()
            scope.addVariableDeclaration('v', {
                isImmutable: false,
                isolationLevel: ISOLATED,
                lattice: IntegerLattice.singleton(12n),
            })

            const result = scope.setCurrentValue(
                'v',
                IntegerLattice.unconstrained(),
            )
            expect(result.isSuccess && result.value).toBeFalse()

            expect(scope.currentValue('v')).toMatchObject({
                min: 12n,
                max: 12n,
            })
        })

        it('fails if variable is missing', () => {
            const scope = Scope.createRoot()

            const result = scope.setCurrentValue(
                'v',
                IntegerLattice.unconstrained(),
            )
            expect(result.isSuccess && result.value).toBeFalse()

            expect(scope.currentValue('v')).toBeNil()
        })
    })

    describe('variables in root scope', () => {
        it('defaults to the entire lattice', () => {
            const scope = Scope.createRoot()
            scope.rootScope.addVariableDeclaration('v', {
                isImmutable: false,
                isolationLevel: ISOLATED,
                lattice: IntegerLattice.unconstrained(),
            })

            expect(scope.currentValue('v')).toMatchObject({
                min: undefined,
                max: undefined,
            })
        })

        it('can set a smaller lattice', () => {
            const scope = Scope.createRoot()
            scope.rootScope.addVariableDeclaration('v', {
                isImmutable: false,
                isolationLevel: ISOLATED,
                lattice: IntegerLattice.unconstrained(),
            })

            expect(
                scope.setCurrentValue('v', IntegerLattice.singleton(12n))
                    .isSuccess,
            ).toBeTrue()

            expect(scope.currentValue('v')).toMatchObject({
                min: 12n,
                max: 12n,
            })
        })

        it('fails if setting a wider lattice', () => {
            const scope = Scope.createRoot()
            scope.addVariableDeclaration('v', {
                isImmutable: false,
                isolationLevel: ISOLATED,
                lattice: IntegerLattice.singleton(12n),
            })

            const result = scope.setCurrentValue(
                'v',
                IntegerLattice.unconstrained(),
            )
            expect(result.isSuccess && result.value).toBeFalse()

            expect(scope.currentValue('v')).toMatchObject({
                min: 12n,
                max: 12n,
            })
        })
    })
})
