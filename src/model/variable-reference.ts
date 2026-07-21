import * as cir from '../cir'
import { Context, Expression } from '.'
import { Failable, logSemanticError } from './failable'
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
        return variableResult.map((variable) =>
            Failable.success(
                variable.semantics === 'const' || variable.semantics === 'ref',
            ),
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
        if (value instanceof UniqueTypeLattice)
            throw new Error(
                `Cannot set current value of ${this.name} to a UniqueTypeLattice`,
            )
        context.scope.setCurrentValue(this.name, value)
    }

    toCIRExpression(
        context: Context,
    ): Failable<Extract<cir.Expression, { kind: 'VARIABLE_REF' }>> {
        const result = this.lookupInScope(context).map((variable) =>
            Failable.success({
                kind: 'VARIABLE_REF' as const,
                name: this.name,
                valueSet: variable.valueSet,
            }),
        )
        if (result.isFailure())
            context.errorReporter.reportError(
                result.getError().errors[0].message,
                result.getError().errors[0].span,
            )
        return result
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

export function convertSemantics(semantics: string) {
    return semantics === 'mut' || semantics === 'const' ? 'ISOLATED' : 'SHARED'
}
