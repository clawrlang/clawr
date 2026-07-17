import { Statement, Expression } from '.'
import { Context } from '.'
import { IsolatedTypeLattice, SharedTypeLattice } from './lattice'

export class ReturnStatement implements Statement {
    private constructor(public value: Expression | undefined) {}

    static create(value: Expression | undefined): ReturnStatement {
        return new ReturnStatement(value)
    }

    emitStatement(context: Context & { semantics?: 'const' | 'ref' }) {
        if (this.value) {
            const valueLattice = this.value.currentValue(context)
            if (!valueLattice) {
                throw new Error(
                    `Return statement value does not have a lattice: ${JSON.stringify(
                        this.value,
                    )}`,
                )
            }
            if (
                valueLattice instanceof IsolatedTypeLattice &&
                context.semantics === 'ref'
            )
                context.errorReporter.reportFatalError(
                    `Cannot return an ISOLATED variable as ${context.semantics}`,
                    this.value.span,
                )
            if (
                valueLattice instanceof SharedTypeLattice &&
                context.semantics !== 'ref'
            )
                context.errorReporter.reportFatalError(
                    `Cannot return a SHARED variable as ${context.semantics ?? 'UNIQUE'}`,
                    this.value.span,
                )
            const object = this.value.toCIRExpression(context)
            if (
                (object.kind === 'VARIABLE_REF' ||
                    object.kind === 'FIELD_REF') &&
                !context.semantics &&
                (valueLattice instanceof SharedTypeLattice ||
                    valueLattice instanceof IsolatedTypeLattice)
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
