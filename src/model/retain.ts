import * as cir from '@/cir'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { Result, SuccessResult } from '@/tools/result'
import { SemanticResult } from '@/tools/semantic-result'
import { Context, ContextWithDomain, Expression, isStorage } from '.'
import { FieldReference } from './field-reference'
import { AnyIsolationLevel } from './isolation-level'
import { RCTypeSet, ValueSet } from './value-set'
import { VariableReference } from './variable-reference'

export class Retain implements Expression {
    get span(): SourceCodeSpan {
        return this.value.span
    }

    private constructor(
        public readonly value: VariableReference | FieldReference,
        private readonly valueSet: RCTypeSet,
    ) {}

    static ifStorage<T extends Expression>(
        value: T,
        context: Context,
    ): SemanticResult<T | Retain> {
        if (!isStorage(value)) return Result.value(value)
        const valueResult = value.currentValue(context)
        if (valueResult.isError) return valueResult
        return valueResult.value instanceof RCTypeSet
            ? Result.value(new Retain(value, valueResult.value))
            : Result.value(value as T)
    }

    isEffectivelyConst(): SuccessResult<true> {
        return Result.true
    }

    isolationLevel(context: Context): SemanticResult<AnyIsolationLevel> {
        return this.value.isolationLevel(context)
    }

    domain(context: ContextWithDomain): SemanticResult<ValueSet> {
        return this.value.domain(context)
    }

    currentValue(context: ContextWithDomain): SemanticResult<ValueSet> {
        return this.value.currentValue(context)
    }

    toCIRExpression(
        context: ContextWithDomain,
    ): SemanticResult<cir.Expression> {
        const objectResult = this.value.toCIRExpression(context)
        if (objectResult.isError) return objectResult
        return Result.value({
            kind: 'RETAIN' as const,
            object: objectResult.value,
            value: this.valueSet.toCIR(),
        })
    }
}
