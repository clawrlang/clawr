import { Statement, Expression } from '.'
import { Context } from '../parser'

export class ReturnStatement implements Statement {
    private constructor(public value: Expression | undefined) {}

    static create(value: Expression | undefined): ReturnStatement {
        return new ReturnStatement(value)
    }

    emitStatement(context: Context): void {
        throw new Error('Method not implemented.')
    }
}
