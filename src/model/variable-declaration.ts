import { Context, Declaration, Expression, Statement } from '.'
import { Failable, logSemanticError, pipeFailable } from './failable'
import { Scope } from './scope'
import { LatticeDeclaration } from './lattice-declaration'
import { Lattice } from './lattice'
import { ISOLATED, IsolationLevel, UNIQUE } from './isolation-level'
import { Retain } from './retain'

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

    emitDeclaration(context: Context): void {
        this.emit(context.scope.rootScope, context)
    }

    emitStatement(context: Context) {
        this.emit(context.scope, context)
    }

    private emit(scope: Scope | Scope['rootScope'], context: Context) {
        const initialValue = this.currentValueFromInitial(context)
        this.checkValidity(initialValue, context)

        const lattice =
            this.isImmutable && this.isolationLevel === ISOLATED
                ? initialValue
                : (this.lattice ?? initialValue.unconstrained())

        this.emitCIRDeclaration(context, lattice, scope).throwIfFailure()
        this.addDeclarationToScope(scope, lattice)
        this.setCurrentValue(context, initialValue)
    }

    private emitCIRDeclaration(
        context: Context,
        lattice: Lattice,
        scope: Scope | Scope['rootScope'],
    ): Failable {
        return Failable.pipe(
            Retain.ifStorage(this.initialValue, context),
            (value) =>
                value.toCIRExpression({
                    ...context,
                    explicitLattice: this.lattice,
                    isolationLevel: this.isolationLevel,
                }),
            (initialValue) => {
                scope.emitted.push({
                    kind: 'VARIABLE_DECL' as const,
                    name: this.name,
                    lattice: lattice.toCIR(),
                    initialValue: initialValue,
                })
            },
        )
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

    private checkValidity(currentValue: Lattice, context: Context) {
        if (!this.isValidValue(currentValue))
            logSemanticError('Incompatible initial value', {
                ...context,
                span: this.initialValue.span,
            })

        const valueIsolationLevel = this.initialValue
            .isolationLevel(context)
            .value()
        if (valueIsolationLevel === UNIQUE) return
        if (this.isolationLevel !== valueIsolationLevel)
            logSemanticError(
                `Cannot assign ${valueIsolationLevel} value to ${this.isolationLevel} target`,
                { ...context, span: this.initialValue.span },
            )
    }

    private isValidValue(currentValue: Lattice) {
        return !this.lattice || this.lattice.isSupersetTo(currentValue)
    }

    private currentValueFromInitial(context: Context) {
        return this.initialValue
            .currentValue({
                ...context,
                explicitLattice: this.lattice,
            })
            .value()
    }
}
