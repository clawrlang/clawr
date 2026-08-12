import { Context, Expression, Statement } from '.'
import { RCTypeLattice } from './lattice'
import { logSemanticError } from './failable'

export class ReturnStatement implements Statement {
    private constructor(public value: Expression | undefined) {}

    static create(value: Expression | undefined): ReturnStatement {
        return new ReturnStatement(value)
    }

    emitStatement(context: Context & { semantics?: 'const' | 'ref' }) {
        if (this.value) {
            const valueLattice = this.value.currentValue(context).value()
            if (!valueLattice) {
                throw new Error(
                    `Return statement value does not have a lattice: ${JSON.stringify(
                        this.value,
                    )}`,
                )
            }
            if (
                valueLattice instanceof RCTypeLattice &&
                valueLattice.semantics === 'ISOLATED' &&
                context.semantics === 'ref'
            )
                logSemanticError(
                    `Cannot return an ISOLATED variable as ${context.semantics}`,
                    { ...context, span: this.value.span },
                )
            if (
                valueLattice instanceof RCTypeLattice &&
                valueLattice.semantics === 'SHARED' &&
                context.semantics !== 'ref'
            )
                logSemanticError(
                    `Cannot return a SHARED variable as ${context.semantics ?? 'UNIQUE'}`,
                    { ...context, span: this.value.span },
                )

            const object = this.value
                .toCIRExpression({ ...context, semantics: undefined })
                .value()
            if (
                (object.kind === 'VARIABLE_REF' ||
                    object.kind === 'FIELD_REF') &&
                !context.semantics &&
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
                        valueSet: valueLattice.toCIR() as any,
                    },
                })
                context.scope.releaseVariables()
                context.scope.emitted.push({
                    kind: 'RETURN',
                    value: {
                        kind: 'VARIABLE_REF',
                        name: temp,
                        valueSet: valueLattice.toCIR(),
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
