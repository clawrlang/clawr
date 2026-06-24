import { Expression, Context } from '.'
import * as cir from '../cir'

export class VariableReference implements Expression {
    private constructor(private name: string) {}

    static create(name: string): VariableReference {
        return new VariableReference(name)
    }

    toCIR(_: Context): cir.Expression {
        return { kind: 'VARIABLE_REF', name: this.name }
    }

    type(context: Context): string {
        const type = context.scope.variableTypes.get(this.name)
        if (!type)
            throw new Error(
                `Variable ${this.name} is not defined in the current context`,
            )
        return type
    }
}
