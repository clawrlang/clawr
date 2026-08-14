import { Context, Expression, Statement } from '.'
import { RCTypeLattice } from './lattice'
import { logSemanticError } from './failable'

export class ReturnStatement implements Statement {
    private constructor(public value: Expression | undefined) {}

    static create(value: Expression | undefined): ReturnStatement {
        return new ReturnStatement(value)
    }

    emitStatement(context: Context) {
        if (this.value) {
            const valueLattice = this.value.currentValue(context).value()
            const isolationLevel = this.value.isolationLevel(context)
            if (!valueLattice) {
                throw new Error(
                    `Return statement value does not have a lattice: ${JSON.stringify(
                        this.value,
                    )}`,
                )
            }

            const object = this.value
                .toCIRExpression({ ...context, isolationLevel: undefined })
                .value()
            if (
                (object.kind === 'VARIABLE_REF' ||
                    object.kind === 'FIELD_REF') &&
                valueLattice instanceof RCTypeLattice
            ) {
                context.scope.emitted.push({
                    kind: 'ENSURE_UNIQUE',
                    object,
                })
                const temp = context.scope.nextTempVar()
                context.scope.emitted.push({
                    kind: 'VARIABLE_DECL',
                    name: temp,
                    valueSet: valueLattice.toCIR(),
                    initialValue: {
                        kind: 'RETAIN',
                        object,
                    },
                })
                context.scope.releaseVariables()
                context.scope.emitted.push({
                    kind: 'RETURN',
                    value: {
                        kind: 'VARIABLE_REF',
                        name: temp,
                    },
                })
            } else {
                context.scope.releaseVariables()
                context.scope.emitted.push({
                    kind: 'RETURN',
                    value: object,
                })
            }
        } else {
            context.scope.releaseVariables()
            context.scope.emitted.push({
                kind: 'RETURN',
            })
        }
    }
}
