import * as cir from '../cir'
import { Context, Expression } from '.'
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

    toCIRExpression(
        context: Context,
    ): Extract<cir.Expression, { kind: 'VARIABLE_REF' }> {
        this.lookupInScope(context)
        return {
            kind: 'VARIABLE_REF',
            name: this.name,
            valueSet: this.valueSet(context),
        }
    }

    valueSet(context: Context): cir.ValueSet {
        return this.lookupInScope(context).currentValue
    }

    updateCurrentValue(context: Context, newValueSet: cir.ValueSet) {
        const variable = this.lookupInScope(context)
        variable.currentValue =
            newValueSet.type === 'rc-type'
                ? {
                      ...newValueSet,
                      semantics:
                          variable.allowedValues.type === 'rc-type'
                              ? variable.allowedValues.semantics
                              : newValueSet.semantics,
                  }
                : newValueSet
    }

    lookupInScope(context: Context) {
        const variable = context.scope.variableDeclaration(this.name)
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
