import * as cir from '../cir'
import { Context, Expression } from '.'
import { Failable, logSemanticError, SemanticError } from './failable'
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
            })
        return []
    }

    isEffectivelyConst(context: Context): boolean {
        const variableResult = this.lookupInScope(context)
        if (variableResult.isFailure())
            context.errorReporter.reportError(
                variableResult.getError().message,
                variableResult.getError().span,
            )
        const variable = variableResult.value()
        return variable.semantics === 'const' || variable.semantics === 'ref'
    }

    currentValue(context: Context): Lattice {
        const result = context.scope.currentValue(this.name)
        if (!result) {
            throw Failable.failure(
                SemanticError.create({
                    message: `Variable ${this.name} has no value in the current context`,
                    span: this.span,
                }),
            ).getError()
        }
        return result
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
        const variableResult = this.lookupInScope(context)
        if (variableResult.isFailure())
            context.errorReporter.reportError(
                variableResult.getError().message,
                variableResult.getError().span,
            )
        return {
            kind: 'VARIABLE_REF',
            name: this.name,
            valueSet: variableResult.value().valueSet,
        }
    }

    lookupInScope(context: Context) {
        const variable = context.scope.variableDeclaration(this.name)
        if (!variable)
            return Failable.failure(
                SemanticError.create({
                    message: `Variable ${this.name} is not defined in the current context`,
                    span: this.span,
                }),
            )
        return Failable.success(variable)
    }
}

export function convertSemantics(semantics: string) {
    return semantics === 'mut' || semantics === 'const' ? 'ISOLATED' : 'SHARED'
}
