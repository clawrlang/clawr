import * as cir from '@/cir'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { SuccessResult } from '@/tools/result'
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
        if (!isStorage(value)) return SuccessResult.value(value)
        const latticeResult = value.currentValue(context)
        if (latticeResult.isError) return latticeResult
        return latticeResult.value instanceof RCTypeLattice
            ? SuccessResult.value(new Retain(value, latticeResult.value))
            : SuccessResult.value(value as T)
    }

    isEffectivelyConst(): SuccessResult<true> {
        return SuccessResult.true
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
        return SuccessResult.value({
            kind: 'RETAIN' as const,
            object: objectResult.value,
            value: this.lattice.toCIR(),
        })
    }
}
