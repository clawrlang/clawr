import * as cir from '@/cir'
import { Result } from '@/tools/result'
import { SemanticErrorResult, SemanticResult } from '@/tools/semantic-result'
import assert from 'assert'
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

    emitDeclaration(context: Context): SemanticResult {
        return this.emit(context.scope.rootScope, context)
    }

    emitStatement(context: Context): SemanticResult {
        return this.emit(context.scope, context)
    }

    private emit(
        scope: Scope | Scope['rootScope'],
        context: Context,
    ): SemanticResult {
        const initialValueResult = this.currentValueFromInitial(context)
        if (initialValueResult.isError) return initialValueResult
        const initialValue = initialValueResult.value
        const validityResult = this.checkValidity(initialValue, context)
        if (validityResult.isError) return validityResult

        const lattice =
            this.isImmutable && this.isolationLevel === ISOLATED
                ? initialValue
                : (this.lattice ?? initialValue.unconstrained())

        const emissionResult = this.emitCIRDeclaration(context, lattice, scope)
        if (emissionResult.isError) return emissionResult
        scope.addVariableDeclaration(this.name, {
            isImmutable: this.isImmutable,
            isolationLevel: this.isolationLevel!!,
            lattice,
        })
        this.setCurrentValue(context, initialValue)
        return Result.ok
    }

    private emitCIRDeclaration(
        context: Context,
        lattice: Lattice,
        scope: Scope | Scope['rootScope'],
    ): SemanticResult {
        const valueResult = Retain.ifStorage(this.initialValue, context)
        if (valueResult.isError) return valueResult
        const value = valueResult.value

        const initialValueResult = value.toCIRExpression({
            ...context,
            explicitLattice: this.lattice,
            isolationLevel: this.isolationLevel,
        })
        if (initialValueResult.isError) return initialValueResult
        const initialValue: cir.Expression = initialValueResult.value

        scope.emitted.push({
            kind: 'VARIABLE_DECL' as const,
            name: this.name,
            domain: lattice.toCIR(),
            initialValue: initialValue,
        })
        return Result.ok
    }

    private setCurrentValue(context: Context, currentValue: Lattice) {
        assert(
            context.scope.setCurrentValue(this.name, currentValue).isSuccess,
            `Setting current value for variable ${this.name} failed`,
        )
    }

    private checkValidity(
        currentValue: Lattice,
        context: Context,
    ): SemanticResult {
        if (!this.isValidValue(currentValue))
            return SemanticErrorResult.failure(
                'Incompatible initial value',
                this.initialValue.span,
            )

        const valueIsolationLevelResult =
            this.initialValue.isolationLevel(context)
        if (valueIsolationLevelResult.isError) return valueIsolationLevelResult
        const valueIsolationLevel = valueIsolationLevelResult.value
        if (valueIsolationLevel === UNIQUE) return Result.ok
        if (this.isolationLevel !== valueIsolationLevel)
            return SemanticErrorResult.failure(
                `Cannot assign ${valueIsolationLevel} value to ${this.isolationLevel} target`,
                this.initialValue.span,
            )
        return Result.ok
    }

    private isValidValue(currentValue: Lattice) {
        return !this.lattice || this.lattice.isSupersetTo(currentValue)
    }

    private currentValueFromInitial(context: Context): SemanticResult<Lattice> {
        return this.initialValue.currentValue({
            ...context,
            explicitLattice: this.lattice,
        })
    }
}
