import { DataDeclaration } from '@/model/data-declaration'
import { FunctionDeclaration } from '@/model/function-declaration'
import { FunctionName } from '@/model/function-name'
import { InterfaceDeclaration } from '@/model/interface-declaration'
import { IsolationLevel, SHARED, UNKNOWN } from '@/model/isolation-level'
import { ObjectDeclaration } from '@/model/object-declaration'
import { TypeConstraintDeclaration } from '@/model/type-constraint-declaration'
import { TypeName } from '@/model/type-name'
import { RCTypeSet, ValueSet } from '@/model/value-set'
import { ErrorResult, Result } from '@/tools/result'
import * as cir from '@clawr/cir'

class RootScope {
    private readonly variables: Map<string, Variable> = new Map()
    private readonly functions: Map<string, FunctionDeclaration> = new Map()
    private readonly types: Map<string, DataDeclaration | ObjectDeclaration> =
        new Map()
    public readonly emitted: cir.Declaration[] = []
    private readonly baseTypes: Set<string> = new Set()
    private readonly interfaces: Map<string, InterfaceDeclaration> = new Map()
    private readonly typeAliases = new Map<string, TypeConstraintDeclaration>()
    private nextBindingCounter = 0

    nextBindingName(name: string) {
        return `${name}ˇlocal${this.nextBindingCounter++}`
    }

    interfaceDeclaration(name: TypeName): InterfaceDeclaration | undefined {
        return this.interfaces.get(name.canonical())
    }

    addInterfaceDeclaration(decl: InterfaceDeclaration) {
        this.interfaces.set(decl.name.canonical(), decl)
    }

    markAsBase(name: TypeName) {
        this.baseTypes.add(name.canonical())
    }

    isBase(name: TypeName): boolean {
        return this.baseTypes.has(name.canonical())
    }

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

    typeAlias(name: string): TypeConstraintDeclaration | undefined {
        return this.typeAliases.get(name)
    }

    addTypeAlias(name: string, value: TypeConstraintDeclaration): boolean {
        if (this.typeAliases.has(name)) return false
        this.typeAliases.set(name, value)
        return true
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
    private readonly bindingNames: Map<string, string> = new Map()
    private readonly types: Map<string, DataDeclaration | ObjectDeclaration> =
        new Map()
    private currentValues: Map<string, ValueSet> = new Map()
    private readonly outerAssignments = new Set<string>()
    public emitted: cir.Statement[] = []
    private nextTempVarCounter = 0

    private constructor(
        public rootScope: RootScope,
        public parentScope?: Scope,
        public readonly namespace?: string,
        private readonly loopEntry = false,
    ) {}

    static createRoot(parentScope?: Scope, namespace?: string) {
        return new Scope(new RootScope(), parentScope, namespace)
    }

    createChildScope() {
        return new Scope(this.rootScope, this)
    }

    createLoopScope() {
        return new Scope(this.rootScope, this, undefined, true)
    }

    nextTempVar() {
        return `__tempˇ${this.nextTempVarCounter++}`
    }

    dataDeclaration(name: TypeName): DataDeclaration | undefined {
        const decl = this.types.get(name.canonical())
        if (decl instanceof DataDeclaration) return decl
        const globalDecl = this.rootScope.dataDeclaration(name)
        if (globalDecl) return globalDecl
        if (this.parentScope) return this.parentScope.dataDeclaration(name)
        return undefined
    }

    addObjectDeclaration(decl: ObjectDeclaration) {
        this.types.set(decl.name.canonical(), decl)
    }

    interfaceDeclaration(name: TypeName): InterfaceDeclaration | undefined {
        return (
            this.rootScope.interfaceDeclaration(name) ??
            (!name.namespace && this.namespace
                ? this.rootScope.interfaceDeclaration(
                      TypeName.create({
                          name: name.name,
                          namespace: this.namespace,
                      }),
                  )
                : undefined) ??
            this.parentScope?.interfaceDeclaration(name)
        )
    }

    toCIRType(
        value: RCTypeSet,
    ): Extract<cir.ValueSet, { universe: 'rc-type' | 'interface' }>
    toCIRType(value: ValueSet): cir.ValueSet
    toCIRType(value: ValueSet): cir.ValueSet {
        if (value instanceof RCTypeSet) {
            const declaration = this.interfaceDeclaration(value.type)
            if (declaration)
                return { universe: 'interface', ...declaration.name.toCIR() }
            const object = this.objectDeclaration(value.type)
            if (object?.opaque)
                return { universe: 'rc-type', ...object.name.toCIR() }
        }
        return value.toCIR()
    }

    canonicalOpaqueType(value: ValueSet): ValueSet {
        const declaration =
            value instanceof RCTypeSet
                ? this.objectDeclaration(value.type)
                : undefined
        return declaration?.opaque
            ? RCTypeSet.create({ type: declaration.name })
            : value
    }

    markAsBase(name: TypeName) {
        this.rootScope.markAsBase(name)
    }

    isBase(name: TypeName): boolean {
        return this.rootScope.isBase(name)
    }

    objectDeclaration(name: TypeName): ObjectDeclaration | undefined {
        const decl = this.types.get(name.canonical())
        if (decl instanceof ObjectDeclaration) return decl
        const globalDecl = this.rootScope.objectDeclaration(name)
        if (globalDecl) return globalDecl
        if (!name.namespace && this.namespace) {
            const namespaced = this.rootScope.objectDeclaration(
                TypeName.create({ name: name.name, namespace: this.namespace }),
            )
            if (namespaced) return namespaced
        }
        if (this.parentScope) return this.parentScope.objectDeclaration(name)
        return undefined
    }

    functionDeclaration(name: FunctionName): FunctionDeclaration | undefined {
        return (
            this.rootScope.functionDeclaration(name.toString()) ??
            this.parentScope?.functionDeclaration(name)
        )
    }

    typeAlias(name: string): TypeConstraintDeclaration | undefined {
        return (
            this.rootScope.typeAlias(name) ?? this.parentScope?.typeAlias(name)
        )
    }

    addTypeAlias(name: string, value: TypeConstraintDeclaration): boolean {
        return this.rootScope.addTypeAlias(name, value)
    }

    variableDeclaration(name: string): Variable | undefined {
        const variable = this.variables.get(name)
        if (variable) return variable
        const parentVariable =
            this.parentScope?.rootScope === this.rootScope
                ? this.parentScope.variableDeclaration(name)
                : undefined
        if (parentVariable) return parentVariable
        const globalVariable = this.rootScope.variableDeclaration(name)
        if (globalVariable) return globalVariable
        return this.parentScope?.variableDeclaration(name)
    }

    addVariableDeclaration(name: string, value: Variable) {
        if (
            this.parentScope?.rootScope === this.rootScope &&
            this.parentScope.hasLocalBinding(name)
        )
            this.bindingNames.set(name, this.rootScope.nextBindingName(name))
        this.variables.set(name, value)
    }

    private hasLocalBinding(name: string): boolean {
        return (
            this.variables.has(name) ||
            (this.parentScope?.rootScope === this.rootScope &&
                this.parentScope.hasLocalBinding(name))
        )
    }

    bindingName(name: string): string {
        if (this.variables.has(name)) return this.bindingNames.get(name) ?? name
        if (
            this.parentScope?.rootScope === this.rootScope &&
            this.parentScope.variableDeclaration(name)
        )
            return this.parentScope.bindingName(name)
        if (this.rootScope.variableDeclaration(name)) return name
        return this.parentScope?.bindingName(name) ?? name
    }

    selfVariable(): Variable | undefined {
        return this.variableDeclaration('self')
    }

    addSelfVariable(type: TypeName) {
        this.addVariableDeclaration('self', {
            isImmutable: false,
            isolationLevel: SHARED,
            type: RCTypeSet.create({ type }),
        })
    }

    releaseVariables() {
        this.emitted.push(...this.variableReleases())
    }

    private variableReleases(): cir.Statement[] {
        return [...this.variables.entries()]
            .filter((v) => v[1].type instanceof RCTypeSet)
            .map(([name]) => ({
                kind: 'RELEASE',
                object: {
                    kind: 'VARIABLE_REF',
                    name: this.bindingName(name),
                },
            }))
    }

    releaseThrough(boundary: Scope) {
        let scope: Scope | undefined = this
        while (scope) {
            this.emitted.push(...scope.variableReleases())
            if (scope === boundary) return
            scope = scope.parentScope
        }
        throw new Error('Return scope is not an ancestor of the current scope')
    }

    widenOuterAssignments(branches: Scope[]) {
        for (const branch of branches) {
            for (const name of branch.outerAssignments) {
                const variable = this.variableDeclaration(name)
                if (!variable) throw new Error(`Unknown variable: ${name}`)
                const result = this.setCurrentValue(name, variable.type)
                if (result.isError) throw result.error
            }
        }
    }

    currentValue(name: string): ValueSet | undefined {
        const value = this.currentValues.get(name)
        if (value) return value
        const variable = this.variables.get(name)
        if (variable) return variable.type
        if (this.loopEntry) {
            const outer = this.parentScope?.variableDeclaration(name)
            if (
                outer &&
                (!outer.isImmutable || outer.type instanceof RCTypeSet)
            )
                return outer.type
        }
        const parentValue =
            this.parentScope?.rootScope === this.rootScope
                ? this.parentScope.currentValue(name)
                : undefined
        if (parentValue) return parentValue
        const globalValue = this.rootScope.variableDeclaration(name)?.type
        if (globalValue) return globalValue
        return this.parentScope?.currentValue(name)
    }

    setCurrentValue(name: string, valueSet: ValueSet): Result {
        const variable = this.variableDeclaration(name)
        if (!variable) return ErrorResult.failure(`Unknown variable: ${name}`)
        if (!variable?.type.isSupersetTo(valueSet))
            return ErrorResult.failure(`Incompatible value for ${name}`)
        this.currentValues.set(name, valueSet)
        if (!this.variables.has(name)) this.outerAssignments.add(name)
        return Result.ok
    }
}

type Variable = {
    isImmutable: boolean
    isolationLevel: IsolationLevel | UNKNOWN
    type: ValueSet
}
