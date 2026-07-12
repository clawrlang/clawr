import * as cir from '../cir'
import { Context, Expression } from '.'
import { SourceCodeSpan } from '../diagnostics'
import { IntegerLattice, Lattice } from './lattice'

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

    currentValue(context: Context): Lattice {
        return (
            context.scope.currentValue(this.name) ??
            context.errorReporter.reportFatalError(
                `Variable ${this.name} is not defined in the current context`,
                this.span,
            )
        )
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
