import { Statement, Expression, Context } from '.'
import * as cir from '../cir'

export class CallFunc implements Statement {
    private arguments: { label?: string; value: Expression }[] = []

    private constructor(
        private baseName: string,
        args: { label?: string; value: Expression }[],
    ) {
        this.arguments = args
    }

    static create({
        baseName,
        arguments: args,
    }: {
        baseName: string
        arguments: { label?: string; value: Expression }[]
    }): CallFunc {
        return new CallFunc(baseName, args)
    }

    toCIR(context: Context): cir.Statement {
        return {
            kind: 'CALL_FUNC',
            signature: {
                baseName:
                    this.baseName === 'print'
                        ? `print${this.arguments[0].value.valueSet(context).type === 'integer' ? 'Int64' : 'Truthvalue'}`
                        : this.baseName,
                parameters: this.arguments.map((arg, index) => ({
                    label: this.arguments[index].label,
                    type: arg.value.valueSet(context).type,
                })),
            },
            arguments: this.arguments.map((arg) => arg.value.toCIR(context)),
        }
    }
}
