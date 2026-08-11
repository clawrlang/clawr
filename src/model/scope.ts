import * as cir from '../cir'
import { Declaration } from '.'
import { DataDeclaration } from './data-declaration'
import { FunctionDeclaration } from './function-declaration'
import { Lattice, UniqueTypeLattice } from './lattice'

class RootScope {
    public variables: Map<string, Variable> = new Map()
    public declarations: Map<string, Declaration> = new Map()
    public emitted: cir.Declaration[] = []

    dataDeclaration(name: string): DataDeclaration | undefined {
        const decl = this.declarations.get(name)
        if (decl instanceof DataDeclaration) return decl
        return undefined
    }

    functionDeclaration(name: string): FunctionDeclaration | undefined {
        const decl = this.declarations.get(name)
        if (decl instanceof FunctionDeclaration) return decl
        return undefined
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

    dataDeclaration(name: string): DataDeclaration | undefined {
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
            .filter((v) => v[1].valueSet.type === 'rc-type')
            .map((v) => [v[0], v[1].valueSet] as [string, cir.ValueSet])

        for (const v of vars) {
            this.emitted.push({
                kind: 'RELEASE',
                object: {
                    kind: 'VARIABLE_REF',
                    name: v[0],
                    valueSet: v[1],
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
        if (valueSet instanceof UniqueTypeLattice)
            throw new Error(
                `Cannot set current value of ${name} to a UniqueTypeLattice`,
            )
        this.currentValues.set(name, valueSet)
    }
}

type Variable = {
    isImmutable: boolean
    valueSet: cir.ValueSet
}
