import * as cir from '../cir'
import { Declaration } from '.'
import { DataDeclaration } from './data-declaration'
import { VariableSemantics } from './variable-declaration'

export class Scope {
    public variables: Map<string, Variable> = new Map()
    public declarations: Map<string, Declaration> = new Map()
    public emitted: {
        declarations: cir.Declaration[]
        statements: cir.Statement[]
    } = { declarations: [], statements: [] }
    private nextTempVarCounter = 0

    private constructor(public parentScope?: Scope) {}

    static createRoot() {
        return new Scope()
    }

    createChildScope() {
        return new Scope(this)
    }

    nextTempVar() {
        return `__tempˇ${this.nextTempVarCounter++}`
    }

    dataDeclaration(name: string): DataDeclaration | undefined {
        const decl = this.declarations.get(name)
        if (decl instanceof DataDeclaration) return decl
        if (this.parentScope) return this.parentScope.dataDeclaration(name)
        return undefined
    }

    variableDeclaration(name: string): Variable | undefined {
        const variable = this.variables.get(name)
        if (variable) return variable
        if (this.parentScope) return this.parentScope.variableDeclaration(name)
        return undefined
    }
}

type Variable = {
    semantics: VariableSemantics
    type: string
}
