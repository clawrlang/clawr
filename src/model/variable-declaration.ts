import * as cir from '../cir'
import { Statement, Expression, Context } from '.'

export const VARIABLE_KINDS = ['const', 'mut', 'ref', 'mutref'] as const
export type VariableSemantics = (typeof VARIABLE_KINDS)[number]

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
        return {
            kind: 'VARIABLE_DECL',
            name: this.name,
            type: this.type,
            initialValue: this.initialValue.toCIR(context),
        }
    }
}
