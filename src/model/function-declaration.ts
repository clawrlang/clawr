import * as cir from '@/cir'
import { Failable, isFailure, Result } from '@/tools/failable'
import { mapFilter } from '@/tools/map-filter'
import { Context, Declaration, Expression, Statement } from '.'
import { Assignment } from './assignment'
import { FunctionName } from './function-name'
import { AnyIsolationLevel, IsolationLevel, UNIQUE } from './isolation-level'
import { Lattice, RCTypeLattice } from './lattice'
import { LatticeDeclaration } from './lattice-declaration'
import { Parameter } from './parameter'
import { ReturnStatement } from './return-statement'
import { Scope } from './scope'
import { TypeName } from './type-name'
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

    *resultIsolationLevel(context: Context): Failable<AnyIsolationLevel> {
        if (this.result) return Result.value(this.result.isolationLevel)
        if (this.implementation.kind === 'implicit-return')
            return yield* this.implementation.expression.isolationLevel_obsolete(
                context,
            )
        else
            throw new Error(
                `unable to infer isolation level for ${this.baseName}`,
            )
    }

    *lattice(context: Context): Failable<Lattice | undefined> {
        if (this.result) return Result.value(this.result.lattice)
        if (this.implementation.kind === 'implicit-return')
            return yield* this.implementation.expression.currentValue_obsolete(
                this.bodyContext(context),
            )
        return Result.success
    }

    *emitDeclaration(context: Context): Failable {
        context.scope.rootScope.addFunctionDeclaration(this)

        const bodyContext: Context = yield yield* this.makeBodyContext(context)

        const body =
            this.implementation.kind === 'body'
                ? this.implementation.statements
                : [
                      ReturnStatement.create({
                          value: this.implementation.expression,
                          span: undefined as any,
                      }),
                  ]

        for (const stmt of body) yield* stmt.emitStatement(bodyContext)

        if (
            this.implementation.kind === 'body' &&
            !body.some((stmt) => stmt instanceof ReturnStatement)
        )
            bodyContext.scope.releaseVariables()

        const lattice: cir.Lattice | undefined =
            yield yield* this.resultLattice(bodyContext)

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
        return Result.success
    }

    *emitMethod(
        context: Context & { self: TypeName },
    ): Failable<cir.Declaration & { kind: 'FUNCTION_DECL' }> {
        const bodyContext: Context = yield yield* this.makeBodyContext(context)

        const body =
            this.implementation.kind === 'body'
                ? this.implementation.statements
                : [
                      ReturnStatement.create({
                          value: this.implementation.expression,
                          span: this.implementation.expression.span,
                      }),
                  ]

        for (const stmt of body) yield* stmt.emitStatement(bodyContext)

        if (
            this.implementation.kind === 'body' &&
            !body.some((stmt) => stmt instanceof ReturnStatement)
        )
            bodyContext.scope.releaseVariables()

        const lattice: cir.Lattice | undefined =
            yield yield* this.resultLattice(bodyContext)

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

    *emitInitializer(
        context: Context & { self: TypeName },
    ): Failable<cir.Declaration & { kind: 'FUNCTION_DECL' }> {
        const bodyContext: Context = yield yield* this.makeBodyContext(context)

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

        for (const stmt of body) yield* stmt.emitStatement(bodyContext)

        if (
            this.implementation.kind === 'body' &&
            !body.some((stmt) => stmt instanceof ReturnStatement)
        )
            bodyContext.scope.releaseVariables()

        const cirFuncDecl: cir.Declaration = {
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

    private *makeBodyContext(
        context: Context & { self?: TypeName },
    ): Failable<Context> {
        const parameterScope = yield yield* this.scopeAddingParameters(context)
        const contextWithParameters = { ...context, scope: parameterScope }
        const explicitLattice =
            this.implementation.kind === 'implicit-return' && context.self
                ? RCTypeLattice.create({ type: context.self })
                : undefined
        const calleeResult = this.result
            ? this.result
            : this.implementation.kind === 'body'
              ? undefined
              : {
                    isolationLevel:
                        yield yield* this.implementation.expression.isolationLevel_obsolete(
                            contextWithParameters,
                        ),
                    lattice:
                        yield yield* this.implementation.expression.currentValue_obsolete(
                            {
                                ...contextWithParameters,
                                explicitLattice,
                            },
                        ),
                }
        const bodyContext = this.bodyContext({
            ...context,
            scope: parameterScope,
            calleeResult,
        })
        return Result.value(bodyContext)
    }

    private *scopeAddingParameters(context: Context): Failable<Scope> {
        const parameterScope = context.scope.createChildScope()
        for (const param of this.parameters) {
            const latticeResult = param.defaultValue
                ? yield* param.defaultValue.currentValue_obsolete(context)
                : param.lattice
                  ? Result.value(param.lattice)
                  : Result.failure(
                        `Parameter ${param.varName} must have either an explicit value set or a default value.`,
                        param.span,
                    )
            if (isFailure(latticeResult)) return latticeResult
            const lattice: Lattice = yield latticeResult
            parameterScope.variables.set(param.varName, {
                isImmutable: param.isImmutable,
                isolationLevel: param.isolationLevel,
                lattice,
            })
            parameterScope.setCurrentValue(param.varName, lattice)
        }
        return Result.value(parameterScope)
    }

    private *resultLattice(
        context: Context,
    ): Failable<cir.Lattice | undefined> {
        if (this.result) return Result.value(this.result.lattice.toCIR())
        if (this.implementation.kind === 'body') return Result.value(undefined)
        const lattice: Lattice =
            yield yield* this.implementation.expression.currentValue_obsolete(
                context,
            )
        return Result.value(lattice.toCIR())
    }

    private bodyContext(context: Context): Context {
        return {
            ...context,
            scope: context.scope.createChildScope(),
        }
    }
}
