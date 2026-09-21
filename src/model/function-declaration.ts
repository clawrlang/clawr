import * as cir from '@/cir'
import { mapFilter } from '@/tools/map-filter'
import { Result } from '@/tools/result'
import { SemanticErrorResult, SemanticResult } from '@/tools/semantic-result'
import { Context, Declaration, Expression, Statement } from '.'
import { DataLiteral } from './data-literal'
import { DomainDeclaration } from './domain-declaration'
import { FunctionName } from './function-name'
import {
    AnyIsolationLevel,
    IsolationLevel,
    UNIQUE,
    UNKNOWN,
} from './isolation-level'
import { Parameter } from './parameter'
import { ReturnStatement } from './return-statement'
import { Scope } from './scope'
import { SelfAssignment } from './self-assignment'
import { RCTypeSet, ValueSet } from './value-set'

export class FunctionDeclaration implements Declaration {
    private constructor(
        public readonly baseName: string,
        public readonly parameters: Parameter[],
        public readonly result:
            | {
                  domain: DomainDeclaration
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
                  domain: DomainDeclaration
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

    domain(context: Context): SemanticResult<ValueSet | undefined> {
        if (this.result) return Result.value(this.result.domain)
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

        const domainResult = this.resultDomain(bodyContext)
        if (domainResult.isError) return domainResult
        const domain = domainResult.value

        const cirFuncDecl: cir.Declaration = {
            kind: 'FUNCTION_DECL',
            baseName: this.baseName,
            labels: mapFilter(this.parameters, (p) => p.label),
            parameters: this.parameters.map((param) => ({
                name: param.varName,
                domain: param.domain!.toCIR(),
            })),
            domain,
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

        const domainResult = this.resultDomain(bodyContext)
        if (domainResult.isError) return domainResult
        const domain = domainResult.value

        const cirFuncDecl: cir.Declaration = {
            kind: 'FUNCTION_DECL',
            baseName: this.baseName,
            labels: mapFilter(this.parameters, (p) => p.label),
            parameters: this.parameters.map((param) => ({
                name: param.varName,
                domain: param.domain!.toCIR(),
            })),
            domain,
            body: bodyContext.scope.emitted,
        }

        return Result.value(cirFuncDecl)
    }

    emitInitializer(
        context: Context,
    ): SemanticResult<
        cir.Declaration & { kind: 'FUNCTION_DECL'; domain: undefined }
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

        const cirFuncDecl: cir.Declaration & { domain: undefined } = {
            kind: 'FUNCTION_DECL',
            baseName: this.baseName,
            labels: mapFilter(this.parameters, (p) => p.label),
            parameters: this.parameters.map((param) => ({
                name: param.varName,
                domain: param.domain!.toCIR(),
            })),
            domain: undefined,
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
        const explicitDomain =
            this.implementation.kind === 'implicit-return' && self
                ? RCTypeSet.create({
                      type: (self.domain as RCTypeSet).type,
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
                // TODO: ??
                this.implementation.expression.currentValue({
                    ...contextWithParameters,
                    explicitDomain,
                }),
            ])
            if (collected.isError) return collected
            const [isolationLevel, domain] = collected.value
            if (isolationLevel === UNKNOWN)
                return SemanticErrorResult.failure(
                    'Returning UNKNOWN value',
                    this.implementation.expression.span,
                )
            const bodyContext = this.bodyContext({
                ...context,
                scope: parameterScopeResult.value,
                calleeResult: { isolationLevel, domain },
            })
            return Result.value(bodyContext)
        }
    }

    private scopeAddingParameters(context: Context): SemanticResult<Scope> {
        const parameterScope = context.scope.createChildScope()
        for (const param of this.parameters) {
            const domainResult = param.defaultValue
                ? param.defaultValue.currentValue(context)
                : param.domain
                  ? Result.value(param.domain)
                  : SemanticErrorResult.failure(
                        `Parameter ${param.varName} must have either an explicit value set or a default value.`,
                        param.span,
                    )
            if (domainResult.isError) return domainResult
            parameterScope.addVariableDeclaration(param.varName, {
                isImmutable: param.isImmutable,
                isolationLevel: param.isolationLevel,
                domain: domainResult.value,
            })
        }
        return Result.value(parameterScope)
    }

    private resultDomain(
        context: Context,
    ): SemanticResult<cir.ValueSet | undefined> {
        if (this.result) return Result.value(this.result.domain.toCIR())
        if (this.implementation.kind === 'body') return Result.value(undefined)
        const domainResult =
            this.implementation.expression.currentValue(context)
        if (domainResult.isError) return domainResult
        return Result.value(domainResult.value.toCIR())
    }

    private bodyContext(context: Context): Context {
        return {
            ...context,
            scope: context.scope.createChildScope(),
        }
    }
}
