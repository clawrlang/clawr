import * as cir from '../cir'
import { Declaration } from '.'
import { DataDeclaration } from './data-declaration'
import { VariableSemantics } from './variable-declaration'

class RootScope {
    public variables: Map<string, Variable> = new Map()
    public declarations: Map<string, Declaration> = new Map()
    public emitted: cir.Declaration[] = []

    dataDeclaration(name: string): DataDeclaration | undefined {
        const decl = this.declarations.get(name)
        if (decl instanceof DataDeclaration) return decl
        return undefined
    }

    variableDeclaration(name: string): Variable | undefined {
        return this.variables.get(name)
    }
}

export class Scope {
    public variables: Map<string, Variable> = new Map()
    public emitted: cir.Statement[] = []
    private nextTempVarCounter = 0

    private constructor(
        public rootScope: RootScope,
        public parentScope?: Scope,
    ) {}

    static createRoot() {
        return new Scope(new RootScope())
    }

    createChildScope() {
        return new Scope(this.rootScope, this)
    }

    nextTempVar() {
        return `__tempˇ${this.nextTempVarCounter++}`
    }

    dataDeclaration(name: string): DataDeclaration | undefined {
        return this.rootScope.dataDeclaration(name)
    }

    variableDeclaration(name: string): Variable | undefined {
        const variable = this.variables.get(name)
        if (variable) return variable
        if (this.parentScope) return this.parentScope.variableDeclaration(name)
        return this.rootScope.variableDeclaration(name)
    }
}

type Variable = {
    semantics: VariableSemantics
    type: string
}
