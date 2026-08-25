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
    isEffectivelyConst(context: Context): _Failable<boolean>
    isolationLevel(context: Context): _Failable<AnyIsolationLevel>
    declaredLattice(context: ContextWithLattice): _Failable<Lattice>
    currentValue(context: ContextWithLattice): _Failable<Lattice>
    setCurrentValue?(context: Context, value: Lattice): void
    toCIRExpression(context: ContextWithLattice): _Failable<cir.Expression>
}

export interface Statement {
    emitStatement(context: Context): void
}

export interface Declaration {
    emitDeclaration(context: Context): void
}
