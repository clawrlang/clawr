import * as cir from '../cir'
import { ErrorReporter } from '../diagnostics'

export type Context = {
    scope: {
        variableTypes: Map<string, string>
        declarations: Map<string, Declaration>
    }
    errorReporter: ErrorReporter
}

export interface Expression {
    type(context: Context): string
    toCIR(context: Context): cir.Expression
}

export interface Statement {
    toCIR(context: Context): cir.Statement
}

export interface Declaration {
    fields?: { name: string; type: string }[]
    toCIR(context: Context): cir.Declaration
}
