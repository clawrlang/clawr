import * as cir from '../cir'
import { ErrorReporter, SourceCodeSpan } from '../diagnostics'
import { _Failable } from './failable'
import { Failable } from './gen-failable'
import { AnyIsolationLevel, IsolationLevel, UNIQUE } from './isolation-level'
import { Lattice } from './lattice'
import { Scope } from './scope'

export type Context = {
    scope: Scope
    errorReporter: ErrorReporter
    calleeResult?: {
        lattice: Lattice
        isolationLevel: IsolationLevel | UNIQUE
    }
}

export type ContextWithLattice = Context & {
    explicitLattice?: Lattice
    isolationLevel?: IsolationLevel
}

export interface Expression {
    get span(): SourceCodeSpan

    isEffectivelyConst(context: Context): Failable<boolean>
    isolationLevel(context: Context): Failable<AnyIsolationLevel>
    declaredLattice(context: ContextWithLattice): Failable<Lattice>
    currentValue(context: ContextWithLattice): Failable<Lattice>
    toCIRExpression(context: ContextWithLattice): Failable<cir.Expression>

    setCurrentValue?(context: Context, value: Lattice): void

    _isolationLevel(context: Context): _Failable<AnyIsolationLevel>
    _currentValue(context: ContextWithLattice): _Failable<Lattice>
    _toCIRExpression(context: ContextWithLattice): _Failable<cir.Expression>
}

export interface Statement {
    _emitStatement(context: Context): void
}

export interface Declaration {
    _emitDeclaration(context: Context): void
}
