import * as cir from '../cir'
import { Declaration } from '.'
import { DataDeclaration } from './data-declaration'
import { FunctionDeclaration } from './function-declaration'
import { Lattice, RCTypeLattice } from './lattice'
import { TypeName } from './type-name'

class RootScope {
    public variables: Map<string, Variable> = new Map()
    private declarations: Map<string, Declaration> = new Map()
    public emitted: cir.Declaration[] = []

    dataDeclaration(name: TypeName): DataDeclaration | undefined {
        const decl = this.declarations.get(name.canonical())
        if (decl instanceof DataDeclaration) return decl
        return undefined
    }

    addDataDeclaration(name: TypeName, decl: DataDeclaration) {
        this.declarations.set(name.canonical(), decl)
    }

    functionDeclaration(name: string): FunctionDeclaration | undefined {
        const decl = this.declarations.get(name)
        if (decl instanceof FunctionDeclaration) return decl
        return undefined
    }

    addFunctionDeclaration(name: string, decl: FunctionDeclaration) {
        this.declarations.set(name, decl)
    }

    variableDeclaration(name: string): Variable | undefined {
        return this.variables.get(name)
    }
}

export class Scope {
    public variables: Map<string, Variable> = new Map()
    private currentValues: Map<string, Lattice> = new Map()
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

    dataDeclaration(name: TypeName): DataDeclaration | undefined {
        return this.rootScope.dataDeclaration(name)
    }

    functionDeclaration(name: string): FunctionDeclaration | undefined {
        return this.rootScope.functionDeclaration(name)
    }

    variableDeclaration(name: string): Variable | undefined {
        const variable = this.variables.get(name)
        if (variable) return variable
        if (this.parentScope) return this.parentScope.variableDeclaration(name)
        return this.rootScope.variableDeclaration(name)
    }

    releaseVariables() {
        const vars = [...this.variables.entries()]
            .filter((v) => v[1].lattice instanceof RCTypeLattice)
            .map((v) => v[0])

        for (const name of vars) {
            this.emitted.push({
                kind: 'RELEASE',
                object: {
                    kind: 'VARIABLE_REF',
                    name,
                },
            })
        }
    }

    currentValue(name: string): Lattice | undefined {
        const value = this.currentValues.get(name)
        if (value) return value
        if (this.parentScope) return this.parentScope.currentValue(name)
        return undefined
    }

    setCurrentValue(name: string, valueSet: Lattice) {
        this.currentValues.set(name, valueSet)
    }
}

type Variable = {
    isImmutable: boolean
    lattice: Lattice
}
