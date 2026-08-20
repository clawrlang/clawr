import * as cir from '../cir'
import { ErrorReporter, SourceCodeSpan } from '../diagnostics'
import { Failable } from './failable'
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
    setCurrentValue?(context: Context, value: Lattice): void
    toCIRExpression(context: ContextWithLattice): Failable<cir.Expression>
}

export interface Statement {
    emitStatement(context: Context): void
}

export interface Declaration {
    emitDeclaration(context: Context): void
}
