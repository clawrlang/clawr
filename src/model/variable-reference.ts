import * as cir from '@/cir'
import { Context, Expression } from '.'
import { IsolationLevel, UNKNOWN } from './isolation-level'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { Lattice } from './lattice'
import { Failable, isFailure } from '@/tools/failable'
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

    *assignmentPrelude(context: Context): Failable<cir.Statement[]> {
        if (yield yield* this.isEffectivelyConst(context))
            yield Failable.failure(
                `Variable ${this.name} is not mutable`,
                this.span,
            )
        return Failable.success([])
    }

    *isEffectivelyConst(context: Context): Failable<boolean> {
        const variableResult = yield* this.lookupInScope(context)
        const variable: Variable = yield variableResult
        return Failable.success(variable.isImmutable)
    }

    *isolationLevel(context: Context): Failable<IsolationLevel | UNKNOWN> {
        const variableResult = yield* this.lookupInScope(context)
        const variable: Variable = yield variableResult
        return Failable.success(variable.isolationLevel)
    }

    *declaredLattice(context: Context): Failable<Lattice> {
        const variableResult = yield* this.lookupInScope(context)
        if (isFailure(variableResult)) return variableResult
        const variable: Variable = yield variableResult
        return Failable.success(variable.lattice)
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

    *setCurrentValue(context: Context, value: Lattice): Failable {
        context.scope.setCurrentValue(this.name, value)
        return Failable.success()
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

    *lookupInScope(context: Context) {
        const variable = context.scope.variableDeclaration(this.name)
        if (!variable)
            return Failable.failure(
                `Variable ${this.name} is not defined in the current context`,
                this.span,
            )
        return Failable.success(variable)
    }
}
