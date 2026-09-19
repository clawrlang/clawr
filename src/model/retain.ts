import * as cir from '@/cir'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { Result, SuccessResult } from '@/tools/result'
import { SemanticResult } from '@/tools/semantic-result'
import { Context, ContextWithLattice, Expression, isStorage } from '.'
import { FieldReference } from './field-reference'
import { AnyIsolationLevel } from './isolation-level'
import { Lattice, RCTypeLattice } from './lattice'
import { VariableReference } from './variable-reference'

export class Retain implements Expression {
    get span(): SourceCodeSpan {
        return this.value.span
    }

    private constructor(
        public readonly value: VariableReference | FieldReference,
        private readonly lattice: RCTypeLattice,
    ) {}

    static ifStorage<T extends Expression>(
        value: T,
        context: Context,
    ): SemanticResult<T | Retain> {
        if (!isStorage(value)) return Result.value(value)
        const latticeResult = value.currentValue(context)
        if (latticeResult.isError) return latticeResult
        return latticeResult.value instanceof RCTypeLattice
            ? Result.value(new Retain(value, latticeResult.value))
            : Result.value(value as T)
    }

    isEffectivelyConst(): SuccessResult<true> {
        return Result.true
    }

    isolationLevel(context: Context): SemanticResult<AnyIsolationLevel> {
        return this.value.isolationLevel(context)
    }

    declaredLattice(context: ContextWithLattice): SemanticResult<Lattice> {
        return this.value.declaredLattice(context)
    }

    currentValue(context: ContextWithLattice): SemanticResult<Lattice> {
        return this.value.currentValue(context)
    }

    toCIRExpression(
        context: ContextWithLattice,
    ): SemanticResult<cir.Expression> {
        const objectResult = this.value.toCIRExpression(context)
        if (objectResult.isError) return objectResult
        return Result.value({
            kind: 'RETAIN' as const,
            object: objectResult.value,
            value: this.lattice.toCIR(),
        })
    }
}
