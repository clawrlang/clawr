import { Context, Declaration, Expression, Statement } from '.'
import { logSemanticError } from './failable'
import { Scope } from './scope'
import { ExplicitValueSet } from './explicit-value-set'
import { UniqueTypeLattice } from './lattice'

export const VARIABLE_SEMANTICS = ['const', 'mut', 'ref', 'mutref'] as const
export type VariableSemantics = (typeof VARIABLE_SEMANTICS)[number]

export class VariableDeclaration implements Statement, Declaration {
    private constructor(
        private semantics: VariableSemantics,
        private name: string,
        private valueSet: ExplicitValueSet | undefined,
        private initialValue: Expression,
    ) {}

    static create({
        semantics,
        name,
        valueSet,
        initialValue,
    }: {
        semantics: VariableSemantics
        name: string
        valueSet?: ExplicitValueSet
        initialValue: Expression
    }): VariableDeclaration {
        return new VariableDeclaration(semantics, name, valueSet, initialValue)
    }

    emitDeclaration(context: Context): void {
        this.emit(context.scope.rootScope, context)
    }

    emitStatement(context: Context) {
        this.emit(context.scope, context)
    }

    private emit(scope: Scope | Scope['rootScope'], context: Context) {
        const currentValue = this.currentValueFromInitial(context)
        const valueSet =
            this.semantics === 'const'
                ? currentValue.toCIR()
                : (this.valueSet?.toCIR() ??
                  currentValue.unconstrained().toCIR())

        const initialValue = this.initialValue
            .toCIRExpression({
                ...context,
                targetValueSet: valueSet,
            })
            .value()

        if (
            valueSet.type === 'rc-type' &&
            initialValue.valueSet.type === 'rc-type' &&
            valueSet.semantics !== initialValue.valueSet.semantics &&
            !(
                this.initialValue.currentValue(context).value() instanceof
                UniqueTypeLattice
            )
        )
            logSemanticError(
                `Cannot assign ${initialValue.valueSet.semantics} value to ${valueSet.semantics} target`,
                { ...context, span: this.initialValue.span },
            )

        scope.emitted.push({
            kind: 'VARIABLE_DECL' as const,
            name: this.name,
            valueSet,
            initialValue:
                valueSet.type === 'rc-type' &&
                (initialValue.kind === 'VARIABLE_REF' ||
                    initialValue.kind === 'FIELD_REF')
                    ? {
                          kind: 'RETAIN' as const,
                          object: initialValue,
                          valueSet,
                      }
                    : initialValue,
        })

        scope.variables.set(this.name, {
            semantics: this.semantics,
            valueSet,
        })

        context.scope.setCurrentValue(this.name, currentValue)
    }

    private currentValueFromInitial(context: Context) {
        const currentValue = this.initialValue
            .currentValue({
                ...context,
                ...this.valueSet,
            })
            .value()
        if (!(currentValue instanceof UniqueTypeLattice)) return currentValue

        return this.semantics === 'const' || this.semantics === 'mut'
            ? currentValue.asCOW()
            : currentValue.asREF()
    }
}
