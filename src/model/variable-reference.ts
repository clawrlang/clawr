import * as cir from '@/cir'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { isFailure, Result, Success } from '@/tools/result'
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

    assignmentPrelude(context: Context): Result<cir.Statement[]> {
        const constResult = this.isEffectivelyConst(context)
        if (isFailure(constResult)) return constResult
        if (constResult.value)
            return Result.failure(
                `Variable ${this.name} is not mutable`,
                this.span,
            )
        return Result.value([])
    }

    isEffectivelyConst(context: Context): Result<boolean> {
        const variableResult = this.lookupInScope(context)
        if (isFailure(variableResult)) return variableResult
        return Result.value(variableResult.value.isImmutable)
    }

    isolationLevel(context: Context): Result<IsolationLevel | UNKNOWN> {
        const variableResult = this.lookupInScope(context)
        if (isFailure(variableResult)) return variableResult
        return Result.value(variableResult.value.isolationLevel)
    }

    declaredLattice(context: Context): Result<Lattice> {
        const variableResult = this.lookupInScope(context)
        if (isFailure(variableResult)) return variableResult
        return Result.value(variableResult.value.lattice)
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

    setCurrentValue(context: Context, value: Lattice): Success {
        context.scope.setCurrentValue(this.name, value)
        return Result.success
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
