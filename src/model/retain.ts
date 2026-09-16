import * as cir from '@/cir'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { Failable, isFailure, Result, Success } from '@/tools/failable'
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

    static *ifStorage<T extends Expression>(
        value: T,
        context: Context,
    ): Failable<T | Retain> {
        if (!isStorage(value)) return Result.value(value)
        const lattice: Lattice = yield value.currentValue(context)
        return lattice instanceof RCTypeLattice
            ? Result.value(new Retain(value, lattice))
            : Result.value(value as T)
    }

    *isEffectivelyConst_obsolete(): Failable<boolean> {
        return this.isEffectivelyConst()
    }
    isEffectivelyConst(): Success<true> {
        return Result.true
    }

    *isolationLevel_obsolete(context: Context): Failable<AnyIsolationLevel> {
        return this.isolationLevel(context)
    }
    isolationLevel(context: Context): Result<AnyIsolationLevel> {
        return this.value.isolationLevel(context)
    }

    *declaredLattice_obsolete(context: ContextWithLattice): Failable<Lattice> {
        return this.declaredLattice(context)
    }
    declaredLattice(context: ContextWithLattice): Result<Lattice> {
        return this.value.declaredLattice(context)
    }

    *currentValue_obsolete(context: ContextWithLattice): Failable<Lattice> {
        return this.currentValue(context)
    }
    currentValue(context: ContextWithLattice): Result<Lattice> {
        return this.value.currentValue(context)
    }

    *toCIRExpression_obsolete(
        context: ContextWithLattice,
    ): Failable<cir.Expression> {
        return this.toCIRExpression(context)
    }
    toCIRExpression(context: ContextWithLattice): Result<cir.Expression> {
        const objectResult = this.value.toCIRExpression(context)
        if (isFailure(objectResult)) return objectResult
        return Result.value({
            kind: 'RETAIN' as const,
            object: objectResult.value,
            value: this.lattice.toCIR(),
        })
    }
}
