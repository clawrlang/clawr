import { Statement, Expression, Context } from '.'
import * as cir from '../cir'

export class Assignment implements Statement {
    private constructor(
        public target: Expression,
        public value: Expression,
    ) {}

    static create({
        target,
        value,
    }: {
        target: Expression
        value: Expression
    }) {
        return new Assignment(target, value)
    }

    toCIR(context: Context): cir.Statement {
        throw new Error('Method not implemented.')
    }
}
