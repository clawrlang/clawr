import { Statement, Expression, Context } from '.'
import * as cir from '../cir'

export class VariableDeclaration implements Statement {
    private constructor(
        private semantics: 'const' | 'mut',
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
        semantics: 'const' | 'mut'
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
