import { Statement, Expression, Context } from '.'
import { FunctionName } from './function-name'

export class CallFunc implements Statement {
    private arguments: Expression[]

    private constructor(
        private name: FunctionName,
        args: Expression[],
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
        return new CallFunc(
            FunctionName.create({
                baseName,
                labels: args
                    .filter((arg) => arg.label)
                    .map((arg) => arg.label!),
                arity: args.length,
            }),
            args.map((arg) => arg.value),
        )
    }

    emitStatement(context: Context) {
        const _name = this.name.toCIR()
        // TODO: This name rewrite is a hack to make the print function work.
        // We need to add a `HasStringRepresentation` trait, but we don't support traits yet.
        const name = {
            baseName:
                _name.baseName === 'print'
                    ? `print${this.arguments[0].valueSet(context).type === 'integer' ? 'Int64' : 'Truthvalue'}`
                    : _name.baseName,
            labels: _name.labels,
        }
        context.scope.emitted.push({
            kind: 'EXEC',
            name,
            arguments: this.arguments.map((arg) =>
                arg.toCIRExpression(context),
            ),
        })
    }
}
