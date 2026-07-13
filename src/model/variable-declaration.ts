import { Statement, Expression, Context, Declaration } from '.'
import { convertSemantics } from './variable-reference'
import { Scope } from './scope'
import { ValueSet } from './value-set'

export const VARIABLE_SEMANTICS = ['const', 'mut', 'ref', 'mutref'] as const
export type VariableSemantics = (typeof VARIABLE_SEMANTICS)[number]

export class VariableDeclaration implements Statement, Declaration {
    private constructor(
        private semantics: VariableSemantics,
        private name: string,
        private valueSet: ValueSet | undefined,
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
        valueSet?: ValueSet
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
        const currentValue = this.initialValue.currentValue({
            ...context,
            ...this.valueSet,
        })
        const semantics = convertSemantics(this.semantics)
        const valueSet =
            this.semantics === 'const'
                ? currentValue
                      .toValueSet(this.semantics, this.initialValue.span)
                      .toCIR({ semantics })
                : (this.valueSet?.toCIR({ semantics }) ??
                  currentValue
                      .unconstrained()
                      .toValueSet(this.semantics, this.initialValue.span)
                      .toCIR({ semantics }))

        const initialValue = this.initialValue.toCIRExpression({
            ...context,
            targetValueSet: valueSet,
        })

        if (
            valueSet.type === 'rc-type' &&
            initialValue.valueSet.type === 'rc-type' &&
            valueSet.semantics !== initialValue.valueSet.semantics
        )
            context.errorReporter.reportFatalError(
                `Cannot assign ${initialValue.valueSet.semantics} value to ${valueSet.semantics} target`,
                this.initialValue.span,
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
}
