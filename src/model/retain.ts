import * as cir from '@/cir'
import { Expression, Context, ContextWithLattice, isStorage } from '.'
import { SourceCodeSpan } from '@/diagnostics'
import { FieldReference } from './field-reference'
import { Failable } from '@/model/failable'
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
        if (!isStorage(value)) return Failable.success(value)
        const lattice: Lattice = yield yield* value.currentValue(context)
        return lattice instanceof RCTypeLattice
            ? Failable.success(new Retain(value, lattice))
            : Failable.success(value as T)
    }

    *isEffectivelyConst(): Failable<boolean> {
        return Failable.success(true)
    }

    isolationLevel(context: Context): Failable<AnyIsolationLevel> {
        return this.value.isolationLevel(context)
    }

    declaredLattice(context: ContextWithLattice): Failable<Lattice> {
        return this.value.declaredLattice(context)
    }

    currentValue(context: ContextWithLattice): Failable<Lattice> {
        return this.value.currentValue(context)
    }

    *toCIRExpression(context: ContextWithLattice): Failable<cir.Expression> {
        const object = yield yield* this.value.toCIRExpression(context)
        return Failable.success({
            kind: 'RETAIN' as const,
            object,
            value: this.lattice.toCIR(),
        })
    }
}
