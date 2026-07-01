import * as cir from '../cir'
import {
    Statement,
    Expression,
    Context,
    Declaration,
    isReferenceCounted,
} from '.'
import { convertSemantics } from './variable-reference'

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

    toCIRStatements(context: Context): cir.Statement[] {
        return [this.toCIR(context)]
    }

    toCIR(context: Context): cir.VariableDeclaration {
        context.scope.variables.set(this.name, {
            semantics: this.semantics,
            type: this.type,
        })

        const valueSemantics = this.initialValue.semantics(context)
        const targetSemantics = convertSemantics(this.semantics)
        const isValueSemanticsMismatch =
            valueSemantics !== 'UNIQUE' && targetSemantics !== valueSemantics
        if (isValueSemanticsMismatch)
            context.errorReporter.reportFatalError(
                `Cannot assign ${valueSemantics} value to ${targetSemantics} target`,
                {
                    start: this.initialValue.span.start,
                    end: this.initialValue.span.end,
                },
            )

        const valueCIR = this.initialValue.toCIR({
            ...context,
            ...{
                type: this.type,
                semantics: convertSemantics(this.semantics),
            },
        })
        if (
            (valueCIR.kind === 'FIELD_REF' ||
                valueCIR.kind === 'VARIABLE_REF') &&
            isReferenceCounted(this.type)
        )
            return {
                kind: 'VARIABLE_DECL',
                name: this.name,
                type: this.type,
                initialValue: { kind: 'RETAIN', object: valueCIR },
            }
        else
            return {
                kind: 'VARIABLE_DECL',
                name: this.name,
                type: this.type,
                initialValue: valueCIR,
            }
    }
}
