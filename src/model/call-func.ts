import * as cir from '@/cir'
import { Statement, Expression, Context } from '.'
import { mapFilter } from '@/tools/map-filter'
import { FunctionName } from './function-name'
import { Failable } from '@/tools/failable'

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
        const args: cir.Expression[] = yield yield* Failable.map(
            this.arguments,
            (arg) => arg.toCIRExpression(context),
        )
        if (_name.baseName === 'print') {
            const tempName = context.scope.nextTempVar()
            const boxedLattice = { ...args[0].value, boxed: true as const }
            context.scope.emitted.push(
                {
                    kind: 'VARIABLE_DECL',
                    name: tempName,
                    lattice: boxedLattice,
                    initialValue: {
                        kind: 'BOX',
                        expression: args[0],
                        value: boxedLattice,
                    },
                },
                {
                    kind: 'CALL',
                    name: _name,
                    arguments: [
                        {
                            kind: 'VARIABLE_REF',
                            name: tempName,
                            value: boxedLattice,
                        },
                    ],
                },
                {
                    kind: 'RELEASE',
                    object: {
                        kind: 'VARIABLE_REF',
                        name: tempName,
                    },
                },
            )
        } else {
            context.scope.emitted.push({
                kind: 'CALL',
                name: _name,
                arguments: args,
            })
        }
        return Failable.success()
    }
}
