import { Statement, Expression, Context } from '.'

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

    emitStatement(context: Context) {
        context.scope.emitted.push({
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
            arguments: this.arguments.map((arg) =>
                arg.value.toCIRExpression(context),
            ),
        })
    }
}
