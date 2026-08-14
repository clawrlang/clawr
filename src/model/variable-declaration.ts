import { Context, Declaration, Expression, Statement } from '.'
import { logSemanticError } from './failable'
import { Scope } from './scope'
import {
    ExplicitRCTypeValueSet,
    ExplicitValueSet,
    UnspecifiedType,
} from './explicit-value-set'
import { Lattice } from './lattice'

export const VARIABLE_SEMANTICS = ['const', 'mut', 'ref', 'mutref'] as const
export type VariableSemantics = (typeof VARIABLE_SEMANTICS)[number]

export class VariableDeclaration implements Statement, Declaration {
    private constructor(
        private readonly isImmutable: boolean,
        private readonly name: string,
        private readonly valueSet: ExplicitValueSet | UnspecifiedType,
        private readonly initialValue: Expression,
    ) {}

    static create({
        isImmutable,
        name,
        valueSet,
        initialValue,
    }: {
        isImmutable: boolean
        name: string
        valueSet: ExplicitValueSet | UnspecifiedType
        initialValue: Expression
    }): VariableDeclaration {
        return new VariableDeclaration(
            isImmutable,
            name,
            valueSet,
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
            this.isImmutable && this.valueSet.isolationLevel === 'ISOLATED'
                ? initialValue
                : this.valueSet instanceof UnspecifiedType
                  ? initialValue.unconstrained()
                  : this.valueSet?.toLattice(context)

        this.emitCIRDeclaration(context, lattice, scope)
        this.addDeclarationToScope(scope, lattice)
        this.setCurrentValue(context, initialValue)
    }

    private emitCIRDeclaration(
        context: Context,
        lattice: Lattice,
        scope: Scope | Scope['rootScope'],
    ) {
        const initialValue = this.initialValue
            .toCIRExpression({
                ...context,
                ...(this.valueSet instanceof ExplicitRCTypeValueSet
                    ? {
                          type: this.valueSet.type,
                          isolationLevel: this.valueSet.isolationLevel,
                      }
                    : {}),
            })
            .value()

        scope.emitted.push({
            kind: 'VARIABLE_DECL' as const,
            name: this.name,
            valueSet: lattice.toCIR(),
            initialValue:
                this.valueSet instanceof ExplicitRCTypeValueSet &&
                (initialValue.kind === 'VARIABLE_REF' ||
                    initialValue.kind === 'FIELD_REF')
                    ? {
                          kind: 'RETAIN' as const,
                          object: initialValue,
                      }
                    : initialValue,
        })
    }

    private addDeclarationToScope(
        scope: Scope | Scope['rootScope'],
        lattice: Lattice,
    ) {
        scope.variables.set(this.name, {
            isImmutable: this.isImmutable,
            isolationLevel: this.valueSet.isolationLevel!!,
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
        if (
            this.valueSet.isolationLevel !== valueIsolationLevel &&
            valueIsolationLevel !== 'UNIQUE'
        )
            logSemanticError(
                `Cannot assign ${valueIsolationLevel} value to ${this.valueSet.isolationLevel} target`,
                { ...context, span: this.initialValue.span },
            )
    }

    private isValidValue(currentValue: Lattice) {
        return (
            this.valueSet instanceof UnspecifiedType ||
            this.valueSet.isValidValue(currentValue)
        )
    }

    private currentValueFromInitial(context: Context) {
        return this.initialValue
            .currentValue({
                ...context,
                ...this.valueSet,
            })
            .value()
    }
}
