import { Statement, Expression } from '.'
import { Context } from '.'

export class ReturnStatement implements Statement {
    private constructor(public value: Expression | undefined) {}

    static create(value: Expression | undefined): ReturnStatement {
        return new ReturnStatement(value)
    }

    emitStatement(context: Context): void {
        context.scope.emitted.push({
            kind: 'RETURN',
            value: this.value?.toCIRExpression(context),
        })
    }
}
