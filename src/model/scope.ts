import * as cir from '@/cir'
import { ErrorResult, Result } from '@/tools/result'
import { DataDeclaration } from './data-declaration'
import { FunctionDeclaration } from './function-declaration'
import { FunctionName } from './function-name'
import { IsolationLevel, UNKNOWN } from './isolation-level'
import { Lattice, RCTypeLattice } from './lattice'
import { ObjectDeclaration } from './object-declaration'
import { TypeName } from './type-name'

class RootScope {
    private readonly variables: Map<string, Variable> = new Map()
    private readonly functions: Map<string, FunctionDeclaration> = new Map()
    private readonly types: Map<string, DataDeclaration | ObjectDeclaration> =
        new Map()
    public readonly emitted: cir.Declaration[] = []

    dataDeclaration(name: TypeName): DataDeclaration | undefined {
        const decl = this.types.get(name.canonical())
        return decl instanceof DataDeclaration ? decl : undefined
    }

    objectDeclaration(name: TypeName): ObjectDeclaration | undefined {
        const decl = this.types.get(name.canonical())
        return decl instanceof ObjectDeclaration ? decl : undefined
    }

    addDataDeclaration(decl: DataDeclaration) {
        this.types.set(decl.name.canonical(), decl)
    }

    addObjectDeclaration(decl: ObjectDeclaration) {
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

    addVariableDeclaration(name: string, value: Variable) {
        this.variables.set(name, value)
    }
}

export class Scope {
    private readonly variables: Map<string, Variable> = new Map()
    private readonly types: Map<string, DataDeclaration | ObjectDeclaration> =
        new Map()
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
        const decl = this.types.get(name.canonical())
        if (decl instanceof DataDeclaration) return decl
        if (this.parentScope) return this.parentScope.dataDeclaration(name)
        return this.rootScope.dataDeclaration(name)
    }

    addObjectDeclaration(decl: ObjectDeclaration) {
        this.types.set(decl.name.canonical(), decl)
    }

    objectDeclaration(name: TypeName): ObjectDeclaration | undefined {
        const decl = this.types.get(name.canonical())
        if (decl instanceof ObjectDeclaration) return decl
        if (this.parentScope) return this.parentScope.objectDeclaration(name)
        return this.rootScope.objectDeclaration(name)
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

    addVariableDeclaration(name: string, value: Variable) {
        this.variables.set(name, value)
    }

    currentValue(name: string): Lattice | undefined {
        const value = this.currentValues.get(name)
        if (value) return value
        const variable = this.variables.get(name)
        if (variable) return variable.lattice
        if (this.parentScope) return this.parentScope.currentValue(name)
        return this.rootScope.variableDeclaration(name)?.lattice
    }

    setCurrentValue(name: string, lattice: Lattice): Result {
        const variable = this.variableDeclaration(name)
        if (!variable) return ErrorResult.failure(`Unknown variable: ${name}`)
        if (!variable?.lattice.isSupersetTo(lattice))
            return ErrorResult.failure(`Incompatible value for ${name}`)
        this.currentValues.set(name, lattice)
        return Result.ok
    }
}

type Variable = {
    isImmutable: boolean
    isolationLevel: IsolationLevel | UNKNOWN
    lattice: Lattice
}
