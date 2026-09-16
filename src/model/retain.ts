import * as cir from '@/cir'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { Failable, Result } from '@/tools/failable'
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
        const lattice: Lattice =
            yield yield* value.currentValue_obsolete(context)
        return lattice instanceof RCTypeLattice
            ? Result.value(new Retain(value, lattice))
            : Result.value(value as T)
    }

    *isEffectivelyConst_obsolete(): Failable<boolean> {
        return Result.true
    }

    isolationLevel_obsolete(context: Context): Failable<AnyIsolationLevel> {
        return this.value.isolationLevel_obsolete(context)
    }

    declaredLattice_obsolete(context: ContextWithLattice): Failable<Lattice> {
        return this.value.declaredLattice_obsolete(context)
    }

    currentValue_obsolete(context: ContextWithLattice): Failable<Lattice> {
        return this.value.currentValue_obsolete(context)
    }

    *toCIRExpression_obsolete(
        context: ContextWithLattice,
    ): Failable<cir.Expression> {
        const object = yield yield* this.value.toCIRExpression_obsolete(context)
        return Result.value({
            kind: 'RETAIN' as const,
            object,
            value: this.lattice.toCIR(),
        })
    }
}
