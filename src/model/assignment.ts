import * as cir from '../cir'
import { Statement, Expression, Context } from '.'
import { FieldLookupExpression } from './field-lookup-expression'
import { VariableReference } from './variable-reference'

export class Assignment implements Statement {
    private constructor(
        public target: FieldLookupExpression | VariableReference,
        public value: Expression,
    ) {}

    static create({
        target,
        value,
    }: {
        target: FieldLookupExpression | VariableReference
        value: Expression
    }) {
        return new Assignment(target, value)
    }

    toCIR(context: Context): cir.Statement {
        return {
            kind: 'ASSIGN',
            target: this.target.toCIR(context),
            value: this.value.toCIR(context),
        }
    }
}
