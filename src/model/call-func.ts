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
            name: {
                baseName:
                    this.baseName === 'print'
                        ? `print${this.arguments[0].value.valueSet(context).type === 'integer' ? 'Int64' : 'Truthvalue'}`
                        : this.baseName,
                labels: this.arguments
                    .filter((arg) => arg.label)
                    .map((arg) => arg.label!!),
            },
            arguments: this.arguments.map((arg) =>
                arg.value.toCIRExpression(context),
            ),
        })
    }
}
