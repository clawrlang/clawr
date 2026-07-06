import * as cir from '../cir'
import { Statement, Expression, Context, Declaration } from '.'
import { convertSemantics } from './variable-reference'
import { Scope } from './scope'

export const VARIABLE_SEMANTICS = ['const', 'mut', 'ref', 'mutref'] as const
export type VariableSemantics = (typeof VARIABLE_SEMANTICS)[number]

export class VariableDeclaration implements Statement, Declaration {
    private constructor(
        private semantics: VariableSemantics,
        private name: string,
        private type: string,
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
        type: string
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
        const myValueSet = this.buildValueSet()
        const currentValue = {
            ...this.initialValue.toCIRExpression({
                ...context,
                targetValueSet: myValueSet,
            }).valueSet,
            ...{ semantics: (myValueSet as any).semantics },
        }
        scope.variables.set(this.name, {
            semantics: this.semantics,
            allowedValues:
                this.semantics === 'const' ? currentValue : myValueSet,
            currentValue,
        })
        scope.emitted.push(this.toCIR(context))
    }

    private toCIR(context: Context): cir.Declaration & cir.Statement {
        const targetValueSet = this.buildValueSet()
        const initialValue = this.initialValue.toCIRExpression({
            ...context,
            targetValueSet,
        })

        if (initialValue.valueSet.type !== targetValueSet.type)
            context.errorReporter.reportFatalError(
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
            const targetSemantics = convertSemantics(this.semantics)
            const isValueSemanticsMismatch =
                valueSemantics !== 'UNIQUE' &&
                targetSemantics !== valueSemantics
            if (isValueSemanticsMismatch)
                context.errorReporter.reportFatalError(
                    `Cannot assign ${valueSemantics} value to ${targetSemantics} target`,
                    {
                        start: this.initialValue.span.start,
                        end: this.initialValue.span.end,
                    },
                )
        }

        if (
            (initialValue.kind === 'FIELD_REF' ||
                initialValue.kind === 'VARIABLE_REF') &&
            initialValue.valueSet.type === 'rc-type'
        )
            return {
                kind: 'VARIABLE_DECL' as const,
                name: this.name,
                valueSet: targetValueSet,
                initialValue: {
                    kind: 'RETAIN',
                    object: initialValue,
                    valueSet: initialValue.valueSet,
                },
            }
        else
            return {
                kind: 'VARIABLE_DECL' as const,
                name: this.name,
                valueSet: targetValueSet,
                initialValue: initialValue,
            }
    }

    private buildValueSet(): cir.ValueSet {
        switch (this.type) {
            case 'integer':
                return { type: 'integer' }
            case 'truthvalue':
                return { type: 'truthvalue' }
            case 'string':
                return { type: 'string' }
            default:
                return {
                    type: 'rc-type',
                    typeName: this.type,
                    semantics: convertSemantics(this.semantics),
                }
        }
    }
}
