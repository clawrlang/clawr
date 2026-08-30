import * as cir from '@/cir'
import { Statement, Expression, Context } from '.'
import { mapFilter } from '@/tools/map-filter'
import { FunctionName } from './function-name'
import { Failable } from '@/tools/failable'
import { IntegerLattice, Lattice, TruthvalueLattice } from './lattice'

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
            const value: Lattice =
                yield yield* this.arguments[0].currentValue(context)

            if (value instanceof IntegerLattice) {
                // TODO: This name rewrite is a hack to make the print function work.
                // We need to add a `HasStringRepresentation` trait, but we don't support traits yet.
                const name = {
                    baseName: 'printInt64',
                    labels: [],
                }

                context.scope.emitted.push({
                    kind: 'CALL',
                    name,
                    arguments: args,
                })
            } else if (value instanceof TruthvalueLattice) {
                const tempName = context.scope.nextTempVar()
                context.scope.emitted.push(
                    {
                        kind: 'VARIABLE_DECL',
                        name: tempName,
                        lattice: {
                            type: 'rc-type',
                            name: 'clawr¸TruthvalueBox',
                            namespace: 'clawr',
                        },
                        initialValue: {
                            kind: 'BOX',
                            expression: args[0],
                            value: args[0].value as any,
                        },
                    },
                    {
                        kind: 'CALL',
                        name: _name,
                        arguments: [
                            {
                                kind: 'VARIABLE_REF',
                                name: tempName,
                                value: {
                                    type: 'rc-type',
                                    name: 'TruthvalueBox',
                                    namespace: 'clawr',
                                },
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
            }
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
