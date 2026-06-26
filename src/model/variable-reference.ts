import * as cir from '../cir'
import { Expression, Context } from '.'
import { SourceCodeSpan } from '../diagnostics'

export class VariableReference implements Expression {
    private constructor(
        private name: string,
        private span: SourceCodeSpan,
    ) {}

    static create({
        name,
        span,
    }: {
        name: string
        span: SourceCodeSpan
    }): VariableReference {
        return new VariableReference(name, span)
    }

    toCIR(_: Context): cir.VariableReference {
        return { kind: 'VARIABLE_REF', name: this.name }
    }

    isIsolated(context: Context): any {
        const variable = context.scope.variables.get(this.name)
        if (!variable) {
            context.errorReporter.reportFatalError(
                `Variable ${this.name} is not defined in the current context`,
                this.span,
            )
        }
        return variable.kind === 'const' || variable.kind === 'mut'
    }

    type(context: Context): string {
        const variable = context.scope.variables.get(this.name)
        if (!variable) {
            context.errorReporter.reportFatalError(
                `Variable ${this.name} is not defined in the current context`,
                this.span,
            )
        }
        return variable.type
    }
}
