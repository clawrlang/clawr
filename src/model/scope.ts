import * as cir from '@/cir'
import { ErrorResult, Result } from '@/tools/result'
import { DataDeclaration } from './data-declaration'
import { FunctionDeclaration } from './function-declaration'
import { FunctionName } from './function-name'
import { IsolationLevel, SHARED, UNKNOWN } from './isolation-level'
import { ObjectDeclaration } from './object-declaration'
import { TypeName } from './type-name'
import { RCTypeSet, ValueSet } from './value-set'

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
    private currentValues: Map<string, ValueSet> = new Map()
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

    addVariableDeclaration(name: string, value: Variable) {
        this.variables.set(name, value)
    }

    selfVariable(): Variable | undefined {
        return this.variableDeclaration('self')
    }

    addSelfVariable(type: TypeName) {
        this.addVariableDeclaration('self', {
            isImmutable: false,
            isolationLevel: SHARED,
            domain: RCTypeSet.create({ type }),
        })
    }

    releaseVariables() {
        const vars = [...this.variables.entries()]
            .filter((v) => v[1].domain instanceof RCTypeSet)
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

    currentValue(name: string): ValueSet | undefined {
        const value = this.currentValues.get(name)
        if (value) return value
        const variable = this.variables.get(name)
        if (variable) return variable.domain
        if (this.parentScope) return this.parentScope.currentValue(name)
        return this.rootScope.variableDeclaration(name)?.domain
    }

    setCurrentValue(name: string, valueSet: ValueSet): Result {
        const variable = this.variableDeclaration(name)
        if (!variable) return ErrorResult.failure(`Unknown variable: ${name}`)
        if (!variable?.domain.isSupersetTo(valueSet))
            return ErrorResult.failure(`Incompatible value for ${name}`)
        this.currentValues.set(name, valueSet)
        return Result.ok
    }
}

type Variable = {
    isImmutable: boolean
    isolationLevel: IsolationLevel | UNKNOWN
    domain: ValueSet
}
