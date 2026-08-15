import * as cir from '../cir'
import { Context, Expression } from '.'
import { IsolationLevel } from './isolation-level'
import { Failable, logSemanticError } from './failable'
import { SourceCodeSpan } from '../diagnostics'
import { Lattice } from './lattice'

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
        if (this.isEffectivelyConst(context).value())
            logSemanticError(`Variable ${this.name} is not mutable`, {
                ...context,
                span: this.span,
            })
        return []
    }

    isEffectivelyConst(context: Context): Failable<boolean> {
        const variableResult = this.lookupInScope(context)
        if (variableResult.isFailure())
            context.errorReporter.reportError(
                variableResult.getError().errors[0].message,
                variableResult.getError().errors[0].span,
            )
        return variableResult.chaining((variable) =>
            Failable.success(variable.isImmutable),
        )
    }

    isolationLevel(context: Context): Failable<IsolationLevel> {
        return this.lookupInScope(context).chaining((variable) =>
            Failable.success(variable.isolationLevel),
        )
    }

    declaredValueSet(context: Context): Failable<Lattice> {
        return this.lookupInScope(context).chaining((variable) =>
            Failable.success(variable.lattice),
        )
    }

    currentValue(context: Context): Failable<Lattice> {
        const result = context.scope.currentValue(this.name)
        if (!result) {
            return Failable.failure(
                `Variable ${this.name} has no value in the current context`,
                this.span,
            )
        }
        return Failable.success(result)
    }

    setCurrentValue(context: Context, value: Lattice): void {
        context.scope.setCurrentValue(this.name, value)
    }

    toCIRExpression(
        context: Context,
    ): Failable<Extract<cir.Expression, { kind: 'VARIABLE_REF' }>> {
        return this.lookupInScope(context).chaining((variable) =>
            Failable.success({
                kind: 'VARIABLE_REF' as const,
                name: this.name,
                valueSet: variable.lattice.toCIR(),
            }),
        )
    }

    lookupInScope(context: Context) {
        const variable = context.scope.variableDeclaration(this.name)
        if (!variable)
            return Failable.failure(
                `Variable ${this.name} is not defined in the current context`,
                this.span,
            )
        return Failable.success(variable)
    }
}
