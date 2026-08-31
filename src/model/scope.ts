import * as cir from '@/cir'
import { IsolationLevel, UNKNOWN } from './isolation-level'
import { DataDeclaration } from './data-declaration'
import { FunctionDeclaration } from './function-declaration'
import { Lattice, RCTypeLattice } from './lattice'
import { TypeName } from './type-name'
import { FunctionName } from './function-name'

class RootScope {
    public readonly variables: Map<string, Variable> = new Map()
    private readonly functions: Map<string, FunctionDeclaration> = new Map()
    private readonly types: Map<string, DataDeclaration> = new Map()
    public readonly emitted: cir.Declaration[] = []

    dataDeclaration(name: TypeName): DataDeclaration | undefined {
        const decl = this.types.get(name.canonical())
        if (decl instanceof DataDeclaration) return decl
        return undefined
    }

    addDataDeclaration(decl: DataDeclaration) {
        this.types.set(decl.name.canonical(), decl)
    }

    functionDeclaration(name: string): FunctionDeclaration | undefined {
        const decl = this.functions.get(name)
        if (decl instanceof FunctionDeclaration) return decl
        return undefined
    }

    addFunctionDeclaration(decl: FunctionDeclaration) {
        this.functions.set(decl.name().toString(), decl)
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

    functionDeclaration(name: FunctionName): FunctionDeclaration | undefined {
        return this.rootScope.functionDeclaration(name.toString())
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

    setCurrentValue(name: string, lattice: Lattice) {
        this.currentValues.set(name, lattice)
    }
}

export type Variable = {
    isImmutable: boolean
    isolationLevel: IsolationLevel | UNKNOWN
    lattice: Lattice
}
