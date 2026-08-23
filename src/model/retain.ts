import { Expression, Context, ContextWithLattice } from '.'
import * as cir from '../cir'
import { SourceCodeSpan } from '../diagnostics'
import { Failable } from './failable'
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
    ): Failable<T | Retain> {
        if (!isStorage(value)) return Failable.success(value)
        return value.currentValue(context).chaining((lattice) => {
            return lattice instanceof RCTypeLattice
                ? new Retain(value, lattice)
                : (value as T)
        })
    }

    isEffectivelyConst(): Failable<boolean> {
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

    toCIRExpression(context: ContextWithLattice): Failable<cir.Expression> {
        const cir = this.value.toCIRExpression(context).value()
        return Failable.success({
            kind: 'RETAIN' as const,
            object: cir,
            value: this.lattice.toCIR(),
        })
    }
}

function isStorage(value: any): value is VariableReference | FieldReference {
    return value instanceof VariableReference || value instanceof FieldReference
}
