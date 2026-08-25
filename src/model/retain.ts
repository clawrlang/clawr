import { Expression, Context, ContextWithLattice } from '.'
import * as cir from '../cir'
import { SourceCodeSpan } from '../diagnostics'
import { _Failable } from './failable'
import { FieldReference } from './field-reference'
import { Failable } from './gen-failable'
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

    *isEffectivelyConst(): Failable<boolean> {
        return Failable.success(true)
    }
    _isEffectivelyConst(): _Failable<boolean> {
        const result = Failable.do(() => this.isEffectivelyConst())
        return _Failable.of(result)
    }

    isolationLevel(context: Context): Failable<AnyIsolationLevel> {
        return this.value.isolationLevel(context)
    }
    _isolationLevel(context: Context): _Failable<AnyIsolationLevel> {
        const result = Failable.do(() => this.isolationLevel(context))
        return _Failable.of(result)
    }

    declaredLattice(context: ContextWithLattice): Failable<Lattice> {
        return this.value.declaredLattice(context)
    }
    _declaredLattice(context: ContextWithLattice): _Failable<Lattice> {
        const result = Failable.do(() => this.declaredLattice(context))
        return _Failable.of(result)
    }

    currentValue(context: ContextWithLattice): Failable<Lattice> {
        return this.value.currentValue(context)
    }
    _currentValue(context: ContextWithLattice): _Failable<Lattice> {
        const result = Failable.do(() => this.currentValue(context))
        return _Failable.of(result)
    }

    *toCIRExpression(context: ContextWithLattice): Failable<cir.Expression> {
        const object = yield yield* this.value.toCIRExpression(context)
        return Failable.success({
            kind: 'RETAIN' as const,
            object,
            value: this.lattice.toCIR(),
        })
    }
    _toCIRExpression(context: ContextWithLattice): _Failable<cir.Expression> {
        const result = Failable.do(() => this.toCIRExpression(context))
        return _Failable.of(result)
    }
}

function isStorage(value: any): value is VariableReference | FieldReference {
    return value instanceof VariableReference || value instanceof FieldReference
}
