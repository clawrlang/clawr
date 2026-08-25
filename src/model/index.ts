import * as cir from '../cir'
import { ErrorReporter, SourceCodeSpan } from '../diagnostics'
import { _Failable } from './failable'
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
    _isEffectivelyConst(context: Context): _Failable<boolean>
    _isolationLevel(context: Context): _Failable<AnyIsolationLevel>
    _declaredLattice(context: ContextWithLattice): _Failable<Lattice>
    _currentValue(context: ContextWithLattice): _Failable<Lattice>
    setCurrentValue?(context: Context, value: Lattice): void
    _toCIRExpression(context: ContextWithLattice): _Failable<cir.Expression>
}

export interface Statement {
    _emitStatement(context: Context): void
}

export interface Declaration {
    _emitDeclaration(context: Context): void
}
