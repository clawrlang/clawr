import { Context, Declaration, Expression, IsolationLevel, Statement } from '.'
import { logSemanticError } from './failable'
import { Scope } from './scope'
import { ExplicitRCTypeValueSet, ExplicitValueSet } from './explicit-value-set'

export const VARIABLE_SEMANTICS = ['const', 'mut', 'ref', 'mutref'] as const
export type VariableSemantics = (typeof VARIABLE_SEMANTICS)[number]

export class VariableDeclaration implements Statement, Declaration {
    private constructor(
        private readonly isImmutable: boolean,
        private readonly isolationLevel: IsolationLevel,
        private name: string,
        private valueSet: ExplicitValueSet | undefined,
        private initialValue: Expression,
    ) {}

    static create({
        isImmutable,
        isolationLevel,
        name,
        valueSet,
        initialValue,
    }: {
        isImmutable: boolean
        isolationLevel: IsolationLevel
        name: string
        valueSet?: ExplicitValueSet
        initialValue: Expression
    }): VariableDeclaration {
        return new VariableDeclaration(
            isImmutable,
            isolationLevel,
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
            this.isImmutable && this.isolationLevel === 'ISOLATED'
                ? currentValue
                : (this.valueSet?.toLattice(context) ??
                  currentValue.unconstrained())
        if (
            this.valueSet &&
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
            this.isolationLevel !== valueIsolationLevel &&
            valueIsolationLevel !== 'UNIQUE'
        )
            logSemanticError(
                `Cannot assign ${valueIsolationLevel} value to ${this.isolationLevel} target`,
                { ...context, span: this.initialValue.span },
            )

        const initialValue = this.initialValue
            .toCIRExpression({
                ...context,
                ...(this.valueSet instanceof ExplicitRCTypeValueSet
                    ? {
                          type: this.valueSet.type,
                          isolationLevel: this.isolationLevel,
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
            isolationLevel: this.isolationLevel,
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
