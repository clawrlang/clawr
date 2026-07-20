import * as cir from '../cir'
import { Context, Expression, logSemanticError } from '.'
import { SourceCodeSpan } from '../diagnostics'
import { Lattice, UniqueTypeLattice } from './lattice'

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
            logSemanticError(`Variable ${this.name} is not mutable`, {
                ...context,
                span: this.span,
                fatal: true,
            })
        return []
    }

    isEffectivelyConst(context: Context): boolean {
        const variable = this.lookupInScope(context)
        return variable.semantics === 'const' || variable.semantics === 'ref'
    }

    currentValue(context: Context): Lattice {
        return (
            context.scope.currentValue(this.name) ??
            logSemanticError(
                `Variable ${this.name} has no value in the current context`,
                { ...context, span: this.span, fatal: true },
            )
        )
    }

    setCurrentValue(context: Context, value: Lattice): void {
        if (value instanceof UniqueTypeLattice)
            throw new Error(
                `Cannot set current value of ${this.name} to a UniqueTypeLattice`,
            )
        context.scope.setCurrentValue(this.name, value)
    }

    toCIRExpression(
        context: Context,
    ): Extract<cir.Expression, { kind: 'VARIABLE_REF' }> {
        this.lookupInScope(context)
        return {
            kind: 'VARIABLE_REF',
            name: this.name,
            valueSet: this.lookupInScope(context).valueSet,
        }
    }

    lookupInScope(context: Context) {
        const variable = context.scope.variableDeclaration(this.name)
        if (!variable) {
            logSemanticError(
                `Variable ${this.name} is not defined in the current context`,
                { ...context, span: this.span, fatal: true },
            )
        }
        return variable
    }
}

export function convertSemantics(semantics: string) {
    return semantics === 'mut' || semantics === 'const' ? 'ISOLATED' : 'SHARED'
}
