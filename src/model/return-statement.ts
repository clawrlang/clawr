import { Statement, Expression } from '.'
import { Context } from '.'
import { CowTypeLattice, RefTypeLattice } from './lattice'

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
                valueLattice instanceof CowTypeLattice &&
                context.semantics === 'ref'
            )
                context.errorReporter.reportFatalError(
                    `Cannot return a COW variable as ${context.semantics}`,
                    this.value.span,
                )
            if (
                valueLattice instanceof RefTypeLattice &&
                context.semantics !== 'ref'
            )
                context.errorReporter.reportFatalError(
                    `Cannot return a REF variable as ${context.semantics ?? 'UNIQUE'}`,
                    this.value.span,
                )
        }
        context.scope.releaseVariables()
        context.scope.emitted.push({
            kind: 'RETURN',
            value: this.value?.toCIRExpression(context),
        })
    }
}
