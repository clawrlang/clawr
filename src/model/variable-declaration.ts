import * as cir from '@/cir'
import { isFailure, Result } from '@/tools/failable'
import { Context, Declaration, Expression, Statement } from '.'
import { ISOLATED, IsolationLevel, UNIQUE } from './isolation-level'
import { Lattice } from './lattice'
import { LatticeDeclaration } from './lattice-declaration'
import { Retain } from './retain'
import { Scope } from './scope'

export const VARIABLE_SEMANTICS = ['const', 'mut', 'ref', 'mutref'] as const
export type VariableSemantics = (typeof VARIABLE_SEMANTICS)[number]

export class VariableDeclaration implements Statement, Declaration {
    private constructor(
        private readonly isImmutable: boolean,
        private readonly name: string,
        private readonly isolationLevel: IsolationLevel,
        private readonly lattice: LatticeDeclaration | undefined,
        private readonly initialValue: Expression,
    ) {}

    static create({
        isImmutable,
        name,
        isolationLevel,
        lattice: lattice,
        initialValue,
    }: {
        isImmutable: boolean
        name: string
        isolationLevel: IsolationLevel
        lattice?: LatticeDeclaration
        initialValue: Expression
    }): VariableDeclaration {
        return new VariableDeclaration(
            isImmutable,
            name,
            isolationLevel,
            lattice,
            initialValue,
        )
    }

    emitDeclaration(context: Context): Result {
        return this.emit(context.scope.rootScope, context)
    }

    emitStatement(context: Context): Result {
        return this.emit(context.scope, context)
    }

    private emit(scope: Scope | Scope['rootScope'], context: Context): Result {
        const initialValueResult = this.currentValueFromInitial(context)
        if (isFailure(initialValueResult)) return initialValueResult
        const initialValue = initialValueResult.value
        const validityResult = this.checkValidity(initialValue, context)
        if (isFailure(validityResult)) return validityResult

        const lattice =
            this.isImmutable && this.isolationLevel === ISOLATED
                ? initialValue
                : (this.lattice ?? initialValue.unconstrained())

        const emissionResult = this.emitCIRDeclaration(context, lattice, scope)
        if (isFailure(emissionResult)) return emissionResult
        this.addDeclarationToScope(scope, lattice)
        this.setCurrentValue(context, initialValue)
        return Result.success
    }

    private emitCIRDeclaration(
        context: Context,
        lattice: Lattice,
        scope: Scope | Scope['rootScope'],
    ): Result {
        const valueResult = Retain.ifStorage(this.initialValue, context)
        if (isFailure(valueResult)) return valueResult
        const value = valueResult.value

        const initialValueResult = value.toCIRExpression({
            ...context,
            explicitLattice: this.lattice,
            isolationLevel: this.isolationLevel,
        })
        if (isFailure(initialValueResult)) return initialValueResult
        const initialValue: cir.Expression = initialValueResult.value

        scope.emitted.push({
            kind: 'VARIABLE_DECL' as const,
            name: this.name,
            lattice: lattice.toCIR(),
            initialValue: initialValue,
        })
        return Result.success
    }

    private addDeclarationToScope(
        scope: Scope | Scope['rootScope'],
        lattice: Lattice,
    ) {
        scope.variables.set(this.name, {
            isImmutable: this.isImmutable,
            isolationLevel: this.isolationLevel!!,
            lattice,
        })
    }

    private setCurrentValue(context: Context, currentValue: Lattice) {
        context.scope.setCurrentValue(this.name, currentValue)
    }

    private checkValidity(currentValue: Lattice, context: Context): Result {
        if (!this.isValidValue(currentValue))
            return Result.failure(
                'Incompatible initial value',
                this.initialValue.span,
            )

        const valueIsolationLevelResult =
            this.initialValue.isolationLevel(context)
        if (isFailure(valueIsolationLevelResult))
            return valueIsolationLevelResult
        const valueIsolationLevel = valueIsolationLevelResult.value
        if (valueIsolationLevel === UNIQUE) return Result.success
        if (this.isolationLevel !== valueIsolationLevel)
            return Result.failure(
                `Cannot assign ${valueIsolationLevel} value to ${this.isolationLevel} target`,
                this.initialValue.span,
            )
        return Result.success
    }

    private isValidValue(currentValue: Lattice) {
        return !this.lattice || this.lattice.isSupersetTo(currentValue)
    }

    private currentValueFromInitial(context: Context): Result<Lattice> {
        return this.initialValue.currentValue({
            ...context,
            explicitLattice: this.lattice,
        })
    }
}
