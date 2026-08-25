import * as cir from '../cir'
import { Statement, Expression, Context } from '.'
import { mapFilter } from '../tools/map-filter'
import { FunctionName } from './function-name'
import { Failable } from './gen-failable'

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
                labels: mapFilter(args, (arg) => arg.label),
                arity: args.length,
            }),
            args.map((arg) => arg.value),
        )
    }

    *emitStatement(context: Context): Failable {
        const _name = this.name.toCIR()
        // TODO: This name rewrite is a hack to make the print function work.
        // We need to add a `HasStringRepresentation` trait, but we don't support traits yet.
        const name = {
            baseName:
                _name.baseName === 'print'
                    ? `print${(yield yield* this.arguments[0].currentValue(context)).toString() === 'integer' ? 'Int64' : 'Truthvalue'}`
                    : _name.baseName,
            labels: _name.labels,
        }

        const args: cir.Expression[] = yield yield* Failable.map(
            this.arguments,
            (arg) => arg.toCIRExpression(context),
        )
        context.scope.emitted.push({
            kind: 'CALL',
            name,
            arguments: args,
        })
        return Failable.success()
    }
}
