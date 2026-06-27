import * as cir from '../cir'
import { Statement, Expression, Context } from '.'
import { convertSemantics } from './variable-reference'

export const VARIABLE_SEMANTICS = ['const', 'mut', 'ref', 'mutref'] as const
export type VariableSemantics = (typeof VARIABLE_SEMANTICS)[number]

export class VariableDeclaration implements Statement {
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

    toCIR(context: Context): cir.Statement {
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

        return {
            kind: 'VARIABLE_DECL',
            name: this.name,
            type: this.type,
            initialValue: this.initialValue.toCIR(context),
        }
    }
}
