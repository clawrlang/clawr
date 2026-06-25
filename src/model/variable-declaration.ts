import * as cir from '../cir'
import { Statement, Expression, Context } from '.'

export const VARIABLE_SEMANTICS = ['const', 'mut', 'bound', 'ref'] as const
export type Semantics = (typeof VARIABLE_SEMANTICS)[number]

export class VariableDeclaration implements Statement {
    private constructor(
        private semantics: Semantics,
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
        semantics: Semantics
        name: string
        type: string
        initialValue: Expression
    }): VariableDeclaration {
        return new VariableDeclaration(semantics, name, type, initialValue)
    }

    toCIR(context: Context): cir.Statement {
        context.scope.variableTypes.set(this.name, this.type)
        return {
            kind: 'VARIABLE_DECL',
            name: this.name,
            type: this.type,
            initialValue: this.initialValue.toCIR(context),
        }
    }
}
