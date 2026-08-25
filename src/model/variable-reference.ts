import * as cir from '../cir'
import { Context, Expression } from '.'
import { IsolationLevel, UNKNOWN } from './isolation-level'
import { _Failable, logSemanticError } from './failable'
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

    isEffectivelyConst(context: Context): _Failable<boolean> {
        const variableResult = this.lookupInScope(context)
        if (variableResult.isFailure())
            context.errorReporter.reportError(
                variableResult.getError().errors[0].message,
                variableResult.getError().errors[0].span,
            )
        return variableResult.chaining((variable) =>
            _Failable.success(variable.isImmutable),
        )
    }

    isolationLevel(context: Context): _Failable<IsolationLevel | UNKNOWN> {
        return this.lookupInScope(context).chaining((variable) =>
            _Failable.success(variable.isolationLevel),
        )
    }

    declaredLattice(context: Context): _Failable<Lattice> {
        return this.lookupInScope(context).chaining((variable) =>
            _Failable.success(variable.lattice),
        )
    }

    currentValue(context: Context): _Failable<Lattice> {
        const result = context.scope.currentValue(this.name)
        if (!result) {
            return _Failable.failure(
                `Variable ${this.name} has no value in the current context`,
                this.span,
            )
        }
        return _Failable.success(result)
    }

    setCurrentValue(context: Context, value: Lattice): void {
        context.scope.setCurrentValue(this.name, value)
    }

    toCIRExpression(
        context: Context,
    ): _Failable<Extract<cir.Expression, { kind: 'VARIABLE_REF' }>> {
        return _Failable
            .collect([this.lookupInScope(context), this.currentValue(context)])
            .chaining(([, value]) =>
                _Failable.success({
                    kind: 'VARIABLE_REF' as const,
                    name: this.name,
                    value: value.toCIR(),
                }),
            )
    }

    lookupInScope(context: Context) {
        const variable = context.scope.variableDeclaration(this.name)
        if (!variable)
            return _Failable.failure(
                `Variable ${this.name} is not defined in the current context`,
                this.span,
            )
        return _Failable.success(variable)
    }
}
