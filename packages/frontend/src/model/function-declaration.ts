import { Context, Declaration, Expression, Statement } from '@/model'
import { FunctionName } from '@/model/function-name'
import {
    AnyIsolationLevel,
    IsolationLevel,
    UNIQUE,
    UNKNOWN,
} from '@/model/isolation-level'
import { DataLiteral } from '@/model/literals'
import { Parameter } from '@/model/parameter'
import { ReturnStatement } from '@/model/return-statement'
import { Scope } from '@/model/scope'
import { SelfAssignment } from '@/model/self-assignment'
import { TypeConstraintDeclaration } from '@/model/type-constraint-declaration'
import { RCTypeSet, ValueSet } from '@/model/value-set'
import { mapFilter } from '@/tools/map-filter'
import { Result } from '@/tools/result'
import { SemanticErrorResult, SemanticResult } from '@/tools/source-result'
import * as cir from '@clawr/cir'

export class FunctionDeclaration implements Declaration {
    private constructor(
        public readonly baseName: string,
        public readonly parameters: Parameter[],
        public readonly result:
            | {
                  type: TypeConstraintDeclaration
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
                  type: TypeConstraintDeclaration
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

    type(context: Context): SemanticResult<ValueSet | undefined> {
        if (this.result) return Result.value(this.result.type)
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

        const returnTypeResult = this.returnType(bodyContext)
        if (returnTypeResult.isError) return returnTypeResult
        const type = returnTypeResult.value

        const cirFuncDecl: cir.Declaration = {
            kind: 'FUNCTION_DECL',
            baseName: this.baseName,
            labels: mapFilter(this.parameters, (p) => p.label),
            parameters: this.parameters.map((param) => ({
                name: param.varName,
                type: param.type!.toCIR(),
            })),
            type,
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

        const typeResult = this.returnType(bodyContext)
        if (typeResult.isError) return typeResult
        const type = typeResult.value

        const cirFuncDecl: cir.Declaration = {
            kind: 'FUNCTION_DECL',
            baseName: this.baseName,
            labels: mapFilter(this.parameters, (p) => p.label),
            parameters: this.parameters.map((param) => ({
                name: param.varName,
                type: param.type!.toCIR(),
            })),
            type,
            body: bodyContext.scope.emitted,
        }

        return Result.value(cirFuncDecl)
    }

    emitInitializer(context: Context): SemanticResult<
        cir.Declaration & {
            kind: 'FUNCTION_DECL'
            type: { universe: 'void' }
        }
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

        const cirFuncDecl = {
            kind: 'FUNCTION_DECL',
            baseName: this.baseName,
            labels: mapFilter(this.parameters, (p) => p.label),
            parameters: this.parameters.map((param) => ({
                name: param.varName,
                type: param.type!.toCIR(),
            })),
            type: { universe: 'void' } as const,
            body: bodyContext.scope.emitted,
        } satisfies cir.Declaration

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
        const explicitType =
            this.implementation.kind === 'implicit-return' && self
                ? RCTypeSet.create({
                      type: (self.type as RCTypeSet).type,
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
                    explicitType: explicitType,
                }),
            ])
            if (collected.isError) return collected
            const [isolationLevel, type] = collected.value
            if (isolationLevel === UNKNOWN)
                return SemanticErrorResult.failure(
                    'Returning UNKNOWN value',
                    this.implementation.expression.span,
                )
            const bodyContext = this.bodyContext({
                ...context,
                scope: parameterScopeResult.value,
                calleeResult: { isolationLevel, type },
            })
            return Result.value(bodyContext)
        }
    }

    private scopeAddingParameters(context: Context): SemanticResult<Scope> {
        const parameterScope = context.scope.createChildScope()
        for (const param of this.parameters) {
            const typeResult = param.defaultValue
                ? param.defaultValue.currentValue(context)
                : param.type
                  ? Result.value(param.type)
                  : SemanticErrorResult.failure(
                        `Parameter ${param.varName} must have either an explicit value set or a default value.`,
                        param.span,
                    )
            if (typeResult.isError) return typeResult
            parameterScope.addVariableDeclaration(param.varName, {
                isImmutable: param.isImmutable,
                isolationLevel: param.isolationLevel,
                type: typeResult.value,
            })
            context.highlightRecorder?.record('parameter', param.span, [
                'declaration',
                ...(param.isImmutable ? (['readonly'] as const) : []),
            ])
        }
        return Result.value(parameterScope)
    }

    private returnType(
        context: Context,
    ): SemanticResult<cir.ValueSet | { universe: 'void' }> {
        if (this.result) return Result.value(this.result.type.toCIR())
        if (this.implementation.kind === 'body')
            return Result.value({ universe: 'void' })
        const typeResult = this.implementation.expression.currentValue(context)
        if (typeResult.isError) return typeResult
        return Result.value(typeResult.value.toCIR())
    }

    private bodyContext(context: Context): Context {
        return {
            ...context,
            scope: context.scope.createChildScope(),
        }
    }
}
