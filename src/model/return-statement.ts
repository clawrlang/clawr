import { Context, Expression, Statement } from '.'
import { SourceCodeSpan } from '../diagnostics'
import { SemanticError } from './failable'
import { RCTypeLattice } from './lattice'

export class ReturnStatement implements Statement {
    private constructor(
        public readonly value: Expression | undefined,
        public readonly span: SourceCodeSpan,
    ) {}

    static create({
        value,
        span,
    }: {
        value?: Expression
        span: SourceCodeSpan
    }): ReturnStatement {
        return new ReturnStatement(value, span)
    }

    emitStatement(context: Context) {
        if (this.value) {
            if (!context.calleeResult)
                throw SemanticError.create({
                    message: 'Called function has no return value',
                    span: this.value.span,
                })
            const lattice = this.value.currentValue(context).value()
            if (!lattice) {
                throw new Error(
                    `Return statement value does not have a lattice: ${JSON.stringify(
                        this.value,
                    )}`,
                )
            }

            if (!context.calleeResult.lattice.isSupersetTo(lattice))
                throw SemanticError.create({
                    message: 'Return value type mismatch',
                    span: this.value.span,
                })
            if (
                context.calleeResult.isolationLevel !==
                this.value.isolationLevel(context).value()
            )
                throw SemanticError.create({
                    message: `Cannot return an ${this.value.isolationLevel(context).value()} value as ${context.calleeResult.isolationLevel}`,
                    span: this.value.span,
                })

            const object = this.value
                .toCIRExpression({ ...context, isolationLevel: undefined })
                .value()
            if (
                (object.kind === 'VARIABLE_REF' ||
                    object.kind === 'FIELD_REF') &&
                lattice instanceof RCTypeLattice
            ) {
                context.scope.emitted.push({
                    kind: 'ENSURE_UNIQUE',
                    object,
                })
                const temp = context.scope.nextTempVar()
                context.scope.emitted.push({
                    kind: 'VARIABLE_DECL',
                    name: temp,
                    lattice: lattice.toCIR(),
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
            if (context.calleeResult)
                throw SemanticError.create({
                    message: `Must return a ${context.calleeResult.lattice.toString()} value`,
                    span: this.span,
                })

            context.scope.releaseVariables()
            context.scope.emitted.push({
                kind: 'RETURN',
            })
        }
    }
}
