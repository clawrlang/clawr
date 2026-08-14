import { Context, Declaration, Expression, Statement } from '.'
import { logSemanticError } from './failable'
import { Scope } from './scope'
import {
    ExplicitRCTypeValueSet,
    ExplicitValueSet,
    UnspecifiedType,
} from './explicit-value-set'

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
        const currentValue = this.currentValueFromInitial(context)
        const lattice =
            this.isImmutable && this.valueSet.isolationLevel === 'ISOLATED'
                ? currentValue
                : this.valueSet instanceof UnspecifiedType
                  ? currentValue.unconstrained()
                  : this.valueSet?.toLattice(context)
        if (
            !(this.valueSet instanceof UnspecifiedType) &&
            !lattice.isSameType(this.valueSet.toLattice(context))
        )
            return logSemanticError('Incompatible initial value', {
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

        scope.variables.set(this.name, {
            isImmutable: this.isImmutable,
            isolationLevel: this.valueSet.isolationLevel!!,
            lattice,
        })

        context.scope.setCurrentValue(this.name, currentValue)
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
