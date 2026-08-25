import * as cir from '../cir'
import { Context, Declaration, Expression, Statement } from '.'
import { _Failable, logSemanticError } from './failable'
import { Scope } from './scope'
import { LatticeDeclaration } from './lattice-declaration'
import { Lattice } from './lattice'
import { ISOLATED, IsolationLevel, UNIQUE } from './isolation-level'
import { Retain } from './retain'
import { Failable, isFailure } from './gen-failable'

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

    *emitDeclaration(context: Context): Failable {
        this._emit(context.scope.rootScope, context)
        return Failable.success()
    }

    *emitStatement(context: Context): Failable {
        this._emit(context.scope, context)
        return Failable.success()
    }
    _emitDeclaration(context: Context): void {
        this._emit(context.scope.rootScope, context)
    }

    _emitStatement(context: Context) {
        this._emit(context.scope, context)
    }

    private *emit(
        scope: Scope | Scope['rootScope'],
        context: Context,
    ): Failable {
        const initialValue = yield yield* this.currentValueFromInitial(context)
        const validity = yield* this.checkValidity(initialValue, context)
        if (isFailure(validity)) return validity

        const lattice =
            this.isImmutable && this.isolationLevel === ISOLATED
                ? initialValue
                : (this.lattice ?? initialValue.unconstrained())

        const emission = yield* this.emitCIRDeclaration(context, lattice, scope)
        if (isFailure(emission)) return emission
        this.addDeclarationToScope(scope, lattice)
        this.setCurrentValue(context, initialValue)
        return Failable.success()
    }

    private _emit(scope: Scope | Scope['rootScope'], context: Context) {
        const result = Failable.do(() => this.emit(scope, context))
        if (isFailure(result))
            for (const error of result.errors)
                logSemanticError(error.message, {
                    span: error.span,
                    errorReporter: context.errorReporter,
                })

        return _Failable.of(result)
    }

    private *emitCIRDeclaration(
        context: Context,
        lattice: Lattice,
        scope: Scope | Scope['rootScope'],
    ): Failable {
        const valueResult = yield* Retain.ifStorage(this.initialValue, context)
        const value: Expression = yield valueResult

        const initialValueResult = yield* value.toCIRExpression({
            ...context,
            explicitLattice: this.lattice,
            isolationLevel: this.isolationLevel,
        })
        const initialValue: cir.Expression = yield initialValueResult

        scope.emitted.push({
            kind: 'VARIABLE_DECL' as const,
            name: this.name,
            lattice: lattice.toCIR(),
            initialValue: initialValue,
        })
        return Failable.success()
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

    private *checkValidity(currentValue: Lattice, context: Context): Failable {
        if (!this.isValidValue(currentValue))
            yield Failable.failure(
                'Incompatible initial value',
                this.initialValue.span,
            )

        const valueIsolationLevel =
            yield yield* this.initialValue.isolationLevel(context)
        if (valueIsolationLevel === UNIQUE) return Failable.success()
        if (this.isolationLevel !== valueIsolationLevel)
            return Failable.failure(
                `Cannot assign ${valueIsolationLevel} value to ${this.isolationLevel} target`,
                this.initialValue.span,
            )
        return Failable.success()
    }

    private isValidValue(currentValue: Lattice) {
        return !this.lattice || this.lattice.isSupersetTo(currentValue)
    }

    private currentValueFromInitial(context: Context): Failable<Lattice> {
        return this.initialValue.currentValue({
            ...context,
            explicitLattice: this.lattice,
        })
    }
}
