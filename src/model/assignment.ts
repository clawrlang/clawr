import * as cir from '../cir'
import { Statement, Expression, Context } from '.'
import { FieldReference } from './field-reference'
import { VariableReference } from './variable-reference'

export class Assignment implements Statement {
    private constructor(
        public target: FieldReference | VariableReference,
        public value: Expression,
    ) {}

    static create({
        target,
        value,
    }: {
        target: FieldReference | VariableReference
        value: Expression
    }) {
        return new Assignment(target, value)
    }

    toCIR(context: Context): cir.Statement {
        if (this.target.isEffectivelyConst(context))
            throw new Error(`Not mutable and cannot be assigned to`)

        return {
            kind: 'ASSIGN',
            target: this.target.toCIR(context),
            value: this.value.toCIR(context),
        }
    }
}
