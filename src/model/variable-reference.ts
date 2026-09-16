import * as cir from '@/cir'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { Failable, isFailure, Result, Success } from '@/tools/failable'
import { Context, Expression } from '.'
import { IsolationLevel, UNKNOWN } from './isolation-level'
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

    *assignmentPrelude(context: Context): Failable<cir.Statement[]> {
        if (yield this.isEffectivelyConst(context))
            yield Result.failure(
                `Variable ${this.name} is not mutable`,
                this.span,
            )
        return Result.value([])
    }

    *isEffectivelyConst_obsolete(context: Context): Failable<boolean> {
        return this.isEffectivelyConst(context)
    }
    isEffectivelyConst(context: Context): Result<boolean> {
        const variableResult = this.lookupInScope(context)
        if (isFailure(variableResult)) return variableResult
        return Result.value(variableResult.value.isImmutable)
    }

    *isolationLevel_obsolete(
        context: Context,
    ): Failable<IsolationLevel | UNKNOWN> {
        return this.isolationLevel(context)
    }
    isolationLevel(context: Context): Result<IsolationLevel | UNKNOWN> {
        const variableResult = this.lookupInScope(context)
        if (isFailure(variableResult)) return variableResult
        return Result.value(variableResult.value.isolationLevel)
    }

    *declaredLattice_obsolete(context: Context): Failable<Lattice> {
        return this.declaredLattice(context)
    }
    declaredLattice(context: Context): Result<Lattice> {
        const variableResult = this.lookupInScope(context)
        if (isFailure(variableResult)) return variableResult
        return Result.value(variableResult.value.lattice)
    }

    *currentValue_obsolete(context: Context): Failable<Lattice> {
        return this.currentValue(context)
    }
    currentValue(context: Context): Result<Lattice> {
        const result = context.scope.currentValue(this.name)
        if (!result) {
            return Result.failure(
                `Variable ${this.name} has no value in the current context`,
                this.span,
            )
        }
        return Result.value(result)
    }

    *setCurrentValue_obsolete(context: Context, value: Lattice): Failable {
        return this.setCurrentValue(context, value)
    }
    setCurrentValue(context: Context, value: Lattice): Success {
        context.scope.setCurrentValue(this.name, value)
        return Result.success
    }

    *toCIRExpression_obsolete(
        context: Context,
    ): Failable<Extract<cir.Expression, { kind: 'VARIABLE_REF' }>> {
        return this.toCIRExpression(context)
    }
    toCIRExpression(
        context: Context,
    ): Result<Extract<cir.Expression, { kind: 'VARIABLE_REF' }>> {
        const variableResult = this.lookupInScope(context)
        if (isFailure(variableResult)) return variableResult
        const valueResult = this.currentValue(context)
        if (isFailure(valueResult)) return valueResult
        return Result.value({
            kind: 'VARIABLE_REF' as const,
            name: this.name,
            value: valueResult.value.toCIR(),
        })
    }

    private lookupInScope(context: Context) {
        const variable = context.scope.variableDeclaration(this.name)
        if (!variable)
            return Result.failure(
                `Variable ${this.name} is not defined in the current context`,
                this.span,
            )
        return Result.value(variable)
    }
}
