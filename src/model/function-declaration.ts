import * as cir from '@/cir'
import { mapFilter } from '@/tools/map-filter'
import { Result } from '@/tools/result'
import { SemanticErrorResult, SemanticResult } from '@/tools/semantic-result'
import { Context, Declaration, Expression, Statement } from '.'
import { DataLiteral } from './data-literal'
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
import { SelfAssignment } from './self-assignment'

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
        if (this.result) return Result.value(this.result.isolationLevel)
        if (this.implementation.kind === 'implicit-return')
            return this.implementation.expression.isolationLevel(context)
        else
            throw new Error(
                `unable to infer isolation level for ${this.baseName}`,
            )
    }

    lattice(context: Context): SemanticResult<Lattice | undefined> {
        if (this.result) return Result.value(this.result.lattice)
        if (this.implementation.kind === 'implicit-return')
            return this.implementation.expression.currentValue(
                this.bodyContext(context),
            )
        return Result.ok
    }

    emitDeclaration(context: Context): SemanticResult {
        context.scope.rootScope.addFunctionDeclaration(this)

        const bodyContextResult = this.makeBodyContext(context)
        if (bodyContextResult.isError) return bodyContextResult
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

        const bodyResult = SemanticResult.collect(
            body.map((stmt) => stmt.emitStatement(bodyContext)),
        )
        if (bodyResult.isError) return bodyResult

        if (
            this.implementation.kind === 'body' &&
            !body.some((stmt) => stmt instanceof ReturnStatement)
        )
            bodyContext.scope.releaseVariables()

        const latticeResult = this.resultLattice(bodyContext)
        if (latticeResult.isError) return latticeResult
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
        return Result.ok
    }

    emitMethod(
        context: Context,
    ): SemanticResult<cir.Declaration & { kind: 'FUNCTION_DECL' }> {
        const bodyContextResult = this.makeBodyContext(context)
        if (bodyContextResult.isError) return bodyContextResult
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

        const bodyResult = SemanticResult.collect(
            body.map((stmt) => stmt.emitStatement(bodyContext)),
        )
        if (bodyResult.isError) return bodyResult

        if (
            this.implementation.kind === 'body' &&
            !body.some((stmt) => stmt instanceof ReturnStatement)
        )
            bodyContext.scope.releaseVariables()

        const latticeResult = this.resultLattice(bodyContext)
        if (latticeResult.isError) return latticeResult
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

        return Result.value(cirFuncDecl)
    }

    emitInitializer(
        context: Context,
    ): SemanticResult<
        cir.Declaration & { kind: 'FUNCTION_DECL'; lattice: undefined }
    > {
        const bodyContextResult = this.makeBodyContext(context)
        if (bodyContextResult.isError) return bodyContextResult
        const bodyContext = bodyContextResult.value

        if (
            this.implementation.kind === 'implicit-return' &&
            !(this.implementation.expression instanceof DataLiteral)
        )
            return SemanticErrorResult.failure(
                'Cannot assign to `self`',
                this.implementation.expression.span,
            )

        const bodyResult = this.makeInitializerBody()
        if (bodyResult.isError) return bodyResult
        const body = bodyResult.value

        const bodyMapResult = SemanticResult.collect(
            body.map((stmt) => stmt.emitStatement(bodyContext)),
        )
        if (bodyMapResult.isError) return bodyMapResult

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

        return Result.value(cirFuncDecl)
    }

    private makeInitializerBody(): SemanticResult<Statement[]> {
        if (this.implementation.kind === 'body')
            return Result.value(this.implementation.statements)

        if (!(this.implementation.expression instanceof DataLiteral))
            return SemanticErrorResult.failure(
                'Cannot assign to `self`',
                this.implementation.expression.span,
            )
        return Result.value([
            SelfAssignment.create({
                value: this.implementation.expression,
                span: this.implementation.expression.span,
            }),
        ])
    }

    private makeBodyContext(context: Context): SemanticResult<Context> {
        const parameterScopeResult = this.scopeAddingParameters(context)
        if (parameterScopeResult.isError) return parameterScopeResult
        const contextWithParameters = {
            ...context,
            scope: parameterScopeResult.value,
        }

        const self = context.scope.selfVariable()
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
            return Result.value(bodyContext)
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
            if (collected.isError) return collected
            const [isolationLevel, lattice] = collected.value
            if (isolationLevel === UNKNOWN)
                return SemanticErrorResult.failure(
                    'Returning UNKNOWN value',
                    this.implementation.expression.span,
                )
            const bodyContext = this.bodyContext({
                ...context,
                scope: parameterScopeResult.value,
                calleeResult: { isolationLevel, lattice },
            })
            return Result.value(bodyContext)
        }
    }

    private scopeAddingParameters(context: Context): SemanticResult<Scope> {
        const parameterScope = context.scope.createChildScope()
        for (const param of this.parameters) {
            const latticeResult = param.defaultValue
                ? param.defaultValue.currentValue(context)
                : param.lattice
                  ? Result.value(param.lattice)
                  : SemanticErrorResult.failure(
                        `Parameter ${param.varName} must have either an explicit value set or a default value.`,
                        param.span,
                    )
            if (latticeResult.isError) return latticeResult
            parameterScope.addVariableDeclaration(param.varName, {
                isImmutable: param.isImmutable,
                isolationLevel: param.isolationLevel,
                lattice: latticeResult.value,
            })
        }
        return Result.value(parameterScope)
    }

    private resultLattice(
        context: Context,
    ): SemanticResult<cir.Lattice | undefined> {
        if (this.result) return Result.value(this.result.lattice.toCIR())
        if (this.implementation.kind === 'body') return Result.value(undefined)
        const latticeResult =
            this.implementation.expression.currentValue(context)
        if (latticeResult.isError) return latticeResult
        return Result.value(latticeResult.value.toCIR())
    }

    private bodyContext(context: Context): Context {
        return {
            ...context,
            scope: context.scope.createChildScope(),
        }
    }
}
