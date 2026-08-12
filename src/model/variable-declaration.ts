import { Context, Declaration, Expression, Statement } from '.'
import { logSemanticError } from './failable'
import { Scope } from './scope'
import { ExplicitRCTypeValueSet, ExplicitValueSet } from './explicit-value-set'
import { RCTypeLattice } from './lattice'
import { TypeName } from './type-name'

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
                ...(valueSet.type === 'rc-type'
                    ? {
                          type: TypeName.create({
                              name: valueSet.typeName,
                              namespace: valueSet.namespace,
                          }),
                          semantics: valueSet.semantics,
                      }
                    : {}),
            })
            .value()

        if (
            valueSet.type === 'rc-type' &&
            initialValue.valueSet.type === 'rc-type' &&
            valueSet.semantics !== initialValue.valueSet.semantics
        ) {
            const iv = this.initialValue.currentValue(context).value()
            if (iv instanceof RCTypeLattice && iv.semantics !== 'UNIQUE')
                logSemanticError(
                    `Cannot assign ${initialValue.valueSet.semantics} value to ${valueSet.semantics} target`,
                    { ...context, span: this.initialValue.span },
                )
        }

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
            isImmutable: this.semantics === 'const' || this.semantics === 'ref',
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
        if (
            !(currentValue instanceof RCTypeLattice) ||
            currentValue.semantics !== 'UNIQUE'
        )
            return currentValue

        return RCTypeLattice.create({
            type: currentValue.type,
            fields: currentValue.fields,
            semantics:
                this.semantics === 'const' || this.semantics === 'mut'
                    ? 'ISOLATED'
                    : 'SHARED',
        })
    }
}
