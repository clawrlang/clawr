import * as cir from '../cir'
import { Expression, Context, ValueSet } from '.'
import { SourceCodeSpan } from '../diagnostics'

export class VariableReference implements Expression {
    private constructor(
        public name: string,
        public span: SourceCodeSpan,
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

    assignmentPrelude(context: Context): cir.Statement[] {
        if (this.isEffectivelyConst(context))
            context.errorReporter.reportFatalError(
                `Variable ${this.name} is not mutable`,
                this.span,
            )
        return []
    }

    isEffectivelyConst(context: Context): boolean {
        const variable = this.lookupInScope(context)
        return variable.semantics === 'const' || variable.semantics === 'ref'
    }

    toCIR(context: Context): cir.VariableReference {
        this.lookupInScope(context)
        return { kind: 'VARIABLE_REF', name: this.name }
    }

    semantics(context: Context) {
        const variable = this.lookupInScope(context)
        const semantics = variable.semantics
        return convertSemantics(semantics)
    }

    valueSet(context: Context): ValueSet {
        const variable = this.lookupInScope(context)
        return { type: variable.type }
    }

    lookupInScope(context: Context) {
        const variable = context.scope.variables.get(this.name)
        if (!variable) {
            context.errorReporter.reportFatalError(
                `Variable ${this.name} is not defined in the current context`,
                this.span,
            )
        }
        return variable
    }
}

export function convertSemantics(semantics: string) {
    return semantics === 'mut' || semantics === 'const' ? 'COW' : 'REF'
}
