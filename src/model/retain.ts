import { Expression, Context, ContextWithLattice } from '.'
import * as cir from '../cir'
import { SourceCodeSpan } from '../diagnostics'
import { _Failable } from './failable'
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
    ): _Failable<T | Retain> {
        if (!isStorage(value)) return _Failable.success(value)
        return value._currentValue(context).chaining((lattice) => {
            return lattice instanceof RCTypeLattice
                ? new Retain(value, lattice)
                : (value as T)
        })
    }

    _isEffectivelyConst(): _Failable<boolean> {
        return _Failable.success(true)
    }
    _isolationLevel(context: Context): _Failable<AnyIsolationLevel> {
        return this.value._isolationLevel(context)
    }
    _declaredLattice(context: ContextWithLattice): _Failable<Lattice> {
        return this.value._declaredLattice(context)
    }
    _currentValue(context: ContextWithLattice): _Failable<Lattice> {
        return this.value._currentValue(context)
    }

    _toCIRExpression(context: ContextWithLattice): _Failable<cir.Expression> {
        const cir = this.value._toCIRExpression(context).value()
        return _Failable.success({
            kind: 'RETAIN' as const,
            object: cir,
            value: this.lattice.toCIR(),
        })
    }
}

function isStorage(value: any): value is VariableReference | FieldReference {
    return value instanceof VariableReference || value instanceof FieldReference
}
