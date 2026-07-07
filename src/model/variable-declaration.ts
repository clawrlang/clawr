import * as cir from '../cir'
import { Statement, Expression, Context, Declaration } from '.'
import { convertSemantics } from './variable-reference'
import { Scope } from './scope'
import { ErrorReporter } from '../diagnostics'

export const VARIABLE_SEMANTICS = ['const', 'mut', 'ref', 'mutref'] as const
export type VariableSemantics = (typeof VARIABLE_SEMANTICS)[number]

export class VariableDeclaration implements Statement, Declaration {
    private constructor(
        private semantics: VariableSemantics,
        private name: string,
        private type: string | undefined,
        private initialValue: Expression,
    ) {}

    static create({
        semantics,
        name,
        type,
        initialValue,
    }: {
        semantics: VariableSemantics
        name: string
        type?: string
        initialValue: Expression
    }): VariableDeclaration {
        return new VariableDeclaration(semantics, name, type, initialValue)
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

        const snapshot = snapshotValueSetFromExpression(initialValue)
        const currentValue =
            targetValueSet.type === 'rc-type'
                ? { ...snapshot, semantics: targetValueSet.semantics }
                : snapshot
        scope.variables.set(this.name, {
            semantics: this.semantics,
            allowedValues:
                this.semantics === 'const' ? currentValue : targetValueSet,
            currentValue,
        })

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
        switch (this.type) {
            case undefined:
                return this.initialValue.valueSet(context)
            case 'integer':
            case 'truthvalue':
            case 'string':
                return { type: this.type }
            default:
                return {
                    type: 'rc-type',
                    typeName: this.type,
                    semantics: convertSemantics(this.semantics),
                }
        }
    }
}

function snapshotValueSetFromExpression(
    expression: cir.Expression,
): cir.ValueSet {
    switch (expression.kind) {
        case 'ALLOCATE':
            return {
                ...(structuredClone(expression.valueSet) as Extract<
                    cir.ValueSet,
                    { type: 'rc-type' }
                >),
                fields: expression.fields.map((field) => ({
                    name: field.name,
                    valueSet: snapshotValueSetFromExpression(field.value),
                })),
            }
        case 'STRING_LITERAL':
        case 'INTEGER_LITERAL':
        case 'TRUTHVALUE_LITERAL':
        case 'RETAIN':
        case 'VARIABLE_REF':
        case 'FIELD_REF':
        case 'CALL_FUNC':
            return structuredClone(expression.valueSet) as cir.ValueSet
    }
}
