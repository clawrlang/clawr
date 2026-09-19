import * as cir from '@/cir'
import { mapFilter } from '@/tools/map-filter'
import { isFailure, SemanticResult } from '@/tools/semantic-result'
import { Context, Declaration, Expression, Statement } from '.'
import { Assignment } from './assignment'
import { FunctionName } from './function-name'
import {
    AnyIsolationLevel,
    IsolationLevel,
    UNIQUE,
    UNKNOWN,
} from './isolation-level'
import { Lattice, RCTypeLattice } from './lattice'
import { LatticeDeclaration } from './lattice-declaration'
import { Parameter } from './parameter'
import { ReturnStatement } from './return-statement'
import { Scope } from './scope'
import { VariableReference } from './variable-reference'

export class FunctionDeclaration implements Declaration {
    private constructor(
        public readonly baseName: string,
        public readonly parameters: Parameter[],
        public readonly result:
            | {
                  lattice: LatticeDeclaration
                  isolationLevel: IsolationLevel | UNIQUE
              }
            | undefined,
        public readonly implementation:
            | { kind: 'implicit-return'; expression: Expression }
            | { kind: 'body'; statements: Statement[] },
    ) {}

    static create({
        baseName,
        parameters,
        result,
        implementation,
    }: {
        baseName: string
        parameters: Parameter[]
        result:
            | {
                  lattice: LatticeDeclaration
                  isolationLevel: IsolationLevel | UNIQUE
              }
            | undefined
        implementation:
            | { kind: 'implicit-return'; expression: Expression }
            | { kind: 'body'; statements: Statement[] }
    }): FunctionDeclaration {
        return new FunctionDeclaration(
            baseName,
            parameters,
            result,
            implementation,
        )
    }

    name() {
        return FunctionName.create({
            baseName: this.baseName,
            arity: this.parameters.length,
            labels: mapFilter(this.parameters, (p) => p.label),
        })
    }

    resultIsolationLevel(context: Context): SemanticResult<AnyIsolationLevel> {
        if (this.result) return SemanticResult.value(this.result.isolationLevel)
        if (this.implementation.kind === 'implicit-return')
            return this.implementation.expression.isolationLevel(context)
        else
            throw new Error(
                `unable to infer isolation level for ${this.baseName}`,
            )
    }

    lattice(context: Context): SemanticResult<Lattice | undefined> {
        if (this.result) return SemanticResult.value(this.result.lattice)
        if (this.implementation.kind === 'implicit-return')
            return this.implementation.expression.currentValue(
                this.bodyContext(context),
            )
        return SemanticResult.success
    }

    emitDeclaration(context: Context): SemanticResult {
        context.scope.rootScope.addFunctionDeclaration(this)

        const bodyContextResult = this.makeBodyContext(context)
        if (isFailure(bodyContextResult)) return bodyContextResult
        const bodyContext = bodyContextResult.value

        const body =
            this.implementation.kind === 'body'
                ? this.implementation.statements
                : [
                      ReturnStatement.create({
                          value: this.implementation.expression,
                          span: undefined as any,
                      }),
                  ]

        for (const stmt of body) stmt.emitStatement(bodyContext)

        if (
            this.implementation.kind === 'body' &&
            !body.some((stmt) => stmt instanceof ReturnStatement)
        )
            bodyContext.scope.releaseVariables()

        const latticeResult = this.resultLattice(bodyContext)
        if (isFailure(latticeResult)) return latticeResult
        const lattice = latticeResult.value

        const cirFuncDecl: cir.Declaration = {
            kind: 'FUNCTION_DECL',
            baseName: this.baseName,
            labels: mapFilter(this.parameters, (p) => p.label),
            parameters: this.parameters.map((param) => ({
                name: param.varName,
                lattice: param.lattice!.toCIR(),
            })),
            lattice,
            body: bodyContext.scope.emitted,
        }
        context.scope.rootScope.emitted.push(cirFuncDecl)
        return SemanticResult.success
    }

    emitMethod(
        context: Context,
    ): SemanticResult<cir.Declaration & { kind: 'FUNCTION_DECL' }> {
        const bodyContextResult = this.makeBodyContext(context)
        if (isFailure(bodyContextResult)) return bodyContextResult
        const bodyContext = bodyContextResult.value

        const body =
            this.implementation.kind === 'body'
                ? this.implementation.statements
                : [
                      ReturnStatement.create({
                          value: this.implementation.expression,
                          span: this.implementation.expression.span,
                      }),
                  ]

        for (const stmt of body) stmt.emitStatement(bodyContext)

        if (
            this.implementation.kind === 'body' &&
            !body.some((stmt) => stmt instanceof ReturnStatement)
        )
            bodyContext.scope.releaseVariables()

        const latticeResult = this.resultLattice(bodyContext)
        if (isFailure(latticeResult)) return latticeResult
        const lattice = latticeResult.value

        const cirFuncDecl: cir.Declaration = {
            kind: 'FUNCTION_DECL',
            baseName: this.baseName,
            labels: mapFilter(this.parameters, (p) => p.label),
            parameters: this.parameters.map((param) => ({
                name: param.varName,
                lattice: param.lattice!.toCIR(),
            })),
            lattice,
            body: bodyContext.scope.emitted,
        }

        return SemanticResult.value(cirFuncDecl)
    }

    emitInitializer(
        context: Context,
    ): SemanticResult<
        cir.Declaration & { kind: 'FUNCTION_DECL'; lattice: undefined }
    > {
        const bodyContextResult = this.makeBodyContext(context)
        if (isFailure(bodyContextResult)) return bodyContextResult
        const bodyContext = bodyContextResult.value

        const body =
            this.implementation.kind === 'body'
                ? this.implementation.statements
                : [
                      Assignment.create({
                          target: VariableReference.create({
                              name: 'self',
                              span: this.implementation.expression.span,
                          }),
                          value: this.implementation.expression,
                          span: this.implementation.expression.span,
                      }),
                  ]

        for (const stmt of body) stmt.emitStatement(bodyContext)

        if (
            this.implementation.kind === 'body' &&
            !body.some((stmt) => stmt instanceof ReturnStatement)
        )
            bodyContext.scope.releaseVariables()

        const cirFuncDecl: cir.Declaration & { lattice: undefined } = {
            kind: 'FUNCTION_DECL',
            baseName: this.baseName,
            labels: mapFilter(this.parameters, (p) => p.label),
            parameters: this.parameters.map((param) => ({
                name: param.varName,
                lattice: param.lattice!.toCIR(),
            })),
            lattice: undefined,
            body: bodyContext.scope.emitted,
        }

        return SemanticResult.value(cirFuncDecl)
    }

    private makeBodyContext(context: Context): SemanticResult<Context> {
        const parameterScopeResult = this.scopeAddingParameters(context)
        if (isFailure(parameterScopeResult)) return parameterScopeResult
        const contextWithParameters = {
            ...context,
            scope: parameterScopeResult.value,
        }

        const self = context.scope.variables.get('self')
        if (self && !(self.lattice instanceof RCTypeLattice))
            throw new Error(`'self' variable must be an rc-type`)

        const explicitLattice =
            this.implementation.kind === 'implicit-return' && self
                ? RCTypeLattice.create({
                      type: (self.lattice as RCTypeLattice).type,
                  })
                : undefined

        if (this.result || this.implementation.kind === 'body') {
            const bodyContext = this.bodyContext({
                ...context,
                scope: parameterScopeResult.value,
                calleeResult: this.result,
            })
            return SemanticResult.value(bodyContext)
        } else {
            const collected = SemanticResult.collect([
                this.implementation.expression.isolationLevel(
                    contextWithParameters,
                ),
                this.implementation.expression.currentValue({
                    ...contextWithParameters,
                    explicitLattice,
                }),
            ])
            if (isFailure(collected)) return collected
            const [isolationLevel, lattice] = collected.value
            if (isolationLevel === UNKNOWN)
                return SemanticResult.failure(
                    'Returning UNKNOWN value',
                    this.implementation.expression.span,
                )
            const bodyContext = this.bodyContext({
                ...context,
                scope: parameterScopeResult.value,
                calleeResult: { isolationLevel, lattice },
            })
            return SemanticResult.value(bodyContext)
        }
    }

    private scopeAddingParameters(context: Context): SemanticResult<Scope> {
        const parameterScope = context.scope.createChildScope()
        for (const param of this.parameters) {
            const latticeResult = param.defaultValue
                ? param.defaultValue.currentValue(context)
                : param.lattice
                  ? SemanticResult.value(param.lattice)
                  : SemanticResult.failure(
                        `Parameter ${param.varName} must have either an explicit value set or a default value.`,
                        param.span,
                    )
            if (isFailure(latticeResult)) return latticeResult
            parameterScope.variables.set(param.varName, {
                isImmutable: param.isImmutable,
                isolationLevel: param.isolationLevel,
                lattice: latticeResult.value,
            })
            parameterScope.setCurrentValue(param.varName, latticeResult.value)
        }
        return SemanticResult.value(parameterScope)
    }

    private resultLattice(
        context: Context,
    ): SemanticResult<cir.Lattice | undefined> {
        if (this.result)
            return SemanticResult.value(this.result.lattice.toCIR())
        if (this.implementation.kind === 'body')
            return SemanticResult.value(undefined)
        const latticeResult =
            this.implementation.expression.currentValue(context)
        if (isFailure(latticeResult)) return latticeResult
        return SemanticResult.value(latticeResult.value.toCIR())
    }

    private bodyContext(context: Context): Context {
        return {
            ...context,
            scope: context.scope.createChildScope(),
        }
    }
}
