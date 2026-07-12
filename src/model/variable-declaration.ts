import * as cir from '../cir'
import { Statement, Expression, Context, Declaration } from '.'
import { convertSemantics } from './variable-reference'
import { Scope } from './scope'
import { ErrorReporter } from '../diagnostics'
import { ValueSet } from './value-set'
import { IntegerLattice } from './lattice'

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
        const targetValueSet = this.buildValueSet(context)
        const initialValue = this.initialValue.toCIRExpression({
            ...context,
            targetValueSet,
        })

        this.validateTypeAndSemantics(
            initialValue,
            targetValueSet,
            context.errorReporter,
        )

        scope.variables.set(this.name, {
            semantics: this.semantics,
            valueSet:
                this.semantics === 'const'
                    ? initialValue.valueSet
                    : targetValueSet,
        })

        context.scope.setCurrentValue(
            this.name,
            this.initialValue.currentValue({
                ...context,
                ...{ typeName: (this.valueSet as any)?.typeName },
            }),
        )

        scope.emitted.push({
            kind: 'VARIABLE_DECL' as const,
            name: this.name,
            ...this.initialValueForCIR(initialValue, targetValueSet),
        })
    }

    private validateTypeAndSemantics(
        initialValue: cir.Expression,
        targetValueSet: cir.ValueSet,
        errorReporter: ErrorReporter,
    ) {
        if (initialValue.valueSet.type !== targetValueSet.type)
            errorReporter.reportFatalError(
                `Cannot assign value of type ${initialValue.valueSet.type} to target of type ${targetValueSet.type}`,
                {
                    start: this.initialValue.span.start,
                    end: this.initialValue.span.end,
                },
            )
        if (
            initialValue.valueSet.type === 'rc-type' &&
            targetValueSet.type === 'rc-type'
        ) {
            const valueSemantics = initialValue.valueSet.semantics
            const targetSemantics = targetValueSet.semantics
            const isValueSemanticsMismatch =
                valueSemantics !== 'UNIQUE' &&
                targetSemantics !== valueSemantics
            if (isValueSemanticsMismatch)
                errorReporter.reportFatalError(
                    `Cannot assign ${valueSemantics} value to ${targetSemantics} target`,
                    {
                        start: this.initialValue.span.start,
                        end: this.initialValue.span.end,
                    },
                )
        }
    }

    private initialValueForCIR(
        initialValue: cir.Expression,
        valueSet: cir.ValueSet,
    ): { initialValue: cir.Expression; valueSet: cir.ValueSet } {
        if (
            (initialValue.kind === 'FIELD_REF' ||
                initialValue.kind === 'VARIABLE_REF') &&
            initialValue.valueSet.type === 'rc-type'
        )
            return {
                initialValue: {
                    kind: 'RETAIN',
                    object: initialValue,
                    valueSet: initialValue.valueSet,
                },
                valueSet,
            }
        else if (this.semantics === 'mut')
            switch (valueSet.type) {
                case 'integer':
                case 'truthvalue':
                case 'string':
                    return {
                        initialValue,
                        valueSet: { type: valueSet.type },
                    }
            }

        return { initialValue, valueSet }
    }

    private buildValueSet(context: Context): cir.ValueSet {
        if (!this.valueSet)
            return this.initialValue.toCIRExpression(context).valueSet
        return this.valueSet.toCIR({
            semantics: convertSemantics(this.semantics),
        })
    }
}
