import * as cir from '../cir'
import { Context, Expression } from '.'
import { IsolationLevel, UNKNOWN } from './isolation-level'
import { _Failable, logSemanticError } from './failable'
import { SourceCodeSpan } from '../diagnostics'
import { Lattice } from './lattice'
import { Failable, isFailure } from './gen-failable'
import { Variable } from './scope'

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
        if (this._isEffectivelyConst(context).value())
            logSemanticError(`Variable ${this.name} is not mutable`, {
                ...context,
                span: this.span,
            })
        return []
    }

    *isEffectivelyConst(context: Context): Failable<boolean> {
        const variableResult = yield* this.lookupInScope(context)
        const variable: Variable = yield variableResult
        return Failable.success(variable.isImmutable)
    }

    _isEffectivelyConst(context: Context): _Failable<boolean> {
        const result = Failable.do(() => this.isEffectivelyConst(context))
        return _Failable.of(result)
    }

    *isolationLevel(context: Context): Failable<IsolationLevel | UNKNOWN> {
        const variableResult = yield* this.lookupInScope(context)
        const variable: Variable = yield variableResult
        return Failable.success(variable.isolationLevel)
    }

    _isolationLevel(context: Context): _Failable<IsolationLevel | UNKNOWN> {
        const result = Failable.do(() => this.isolationLevel(context))
        return _Failable.of(result)
    }

    *declaredLattice(context: Context): Failable<Lattice> {
        const variableResult = yield* this.lookupInScope(context)
        if (isFailure(variableResult)) return variableResult
        const variable: Variable = yield variableResult
        return Failable.success(variable.lattice)
    }

    _declaredLattice(context: Context): _Failable<Lattice> {
        const result = Failable.do(() => this.declaredLattice(context))
        return _Failable.of(result)
    }

    *currentValue(context: Context): Failable<Lattice> {
        const result = context.scope.currentValue(this.name)
        if (!result) {
            return Failable.failure(
                `Variable ${this.name} has no value in the current context`,
                this.span,
            )
        }
        return Failable.success(result)
    }

    _currentValue(context: Context): _Failable<Lattice> {
        const result = Failable.do(() => this.currentValue(context))
        return _Failable.of(result)
    }

    setCurrentValue(context: Context, value: Lattice): void {
        context.scope.setCurrentValue(this.name, value)
    }

    *toCIRExpression(
        context: Context,
    ): Failable<Extract<cir.Expression, { kind: 'VARIABLE_REF' }>> {
        const variableResult = yield* this.lookupInScope(context)
        if (isFailure(variableResult)) return variableResult
        const valueResult = yield* this.currentValue(context)
        if (isFailure(valueResult)) return valueResult
        return Failable.success({
            kind: 'VARIABLE_REF' as const,
            name: this.name,
            value: (yield valueResult).toCIR(),
        })
    }

    _toCIRExpression(
        context: Context,
    ): _Failable<Extract<cir.Expression, { kind: 'VARIABLE_REF' }>> {
        const result = Failable.do(() => this.toCIRExpression(context))
        return _Failable.of(result)
    }

    *lookupInScope(context: Context) {
        const variable = context.scope.variableDeclaration(this.name)
        if (!variable)
            return Failable.failure(
                `Variable ${this.name} is not defined in the current context`,
                this.span,
            )
        return Failable.success(variable)
    }

    _lookupInScope(context: Context) {
        const variable = context.scope.variableDeclaration(this.name)
        if (!variable)
            return _Failable.failure(
                `Variable ${this.name} is not defined in the current context`,
                this.span,
            )
        return _Failable.success(variable)
    }
}
