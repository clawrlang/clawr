import * as cir from '../cir'
import { Context, Declaration, Expression, Statement } from '.'
import { AnyIsolationLevel, IsolationLevel, UNIQUE } from './isolation-level'
import { LatticeDeclaration } from './lattice-declaration'
import { ReturnStatement } from './return-statement'
import { FunctionName } from './function-name'
import { Lattice } from './lattice'
import { _Failable, logSemanticError } from './failable'
import { mapFilter } from '../tools/map-filter'
import { Parameter } from './parameter'
import { Scope } from './scope'

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

    resultIsolationLevel(context: Context): _Failable<AnyIsolationLevel> {
        if (this.result) return _Failable.success(this.result.isolationLevel)
        if (this.implementation.kind === 'implicit-return')
            return this.implementation.expression._isolationLevel(context)
        else
            throw new Error(
                `unable to infer isolation level for ${this.baseName}`,
            )
    }

    lattice(context: Context): Lattice | undefined {
        if (this.result) return this.result.lattice
        if (this.implementation.kind === 'implicit-return')
            return this.implementation.expression
                ._currentValue(this.bodyContext(context))
                .value()
    }

    _emitDeclaration(context: Context) {
        const name = FunctionName.create({
            baseName: this.baseName,
            arity: this.parameters.length,
            labels: mapFilter(this.parameters, (param) => param.label),
        })
        context.scope.rootScope.addFunctionDeclaration(name.toString(), this)

        const bodyContext = this.makeBodyContext(context)

        const body =
            this.implementation.kind === 'body'
                ? this.implementation.statements
                : [
                      ReturnStatement.create({
                          value: this.implementation.expression,
                          span: undefined as any,
                      }),
                  ]

        for (const stmt of body) stmt._emitStatement(bodyContext)

        if (
            this.implementation.kind === 'body' &&
            !body.some((stmt) => stmt instanceof ReturnStatement)
        )
            bodyContext.scope.releaseVariables()

        const lattice = this.resultLattice(bodyContext)

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
    }

    private makeBodyContext(context: Context): Context {
        const parameterScope = this.scopeAddingParameters(context)

        const contextWithParameters = { ...context, scope: parameterScope }
        const bodyContext = this.bodyContext({
            ...context,
            scope: parameterScope,
            calleeResult: this.result
                ? this.result
                : this.implementation.kind === 'body'
                  ? undefined
                  : {
                        isolationLevel: this.implementation.expression
                            ._isolationLevel(contextWithParameters)
                            .value() as IsolationLevel,
                        lattice: this.implementation.expression
                            ._currentValue(contextWithParameters)
                            .value(),
                    },
        })
        return bodyContext
    }

    private scopeAddingParameters(context: Context): Scope {
        const parameterScope = context.scope.createChildScope()
        for (const param of this.parameters) {
            parameterScope.variables.set(param.varName, {
                isImmutable: param.isImmutable,
                isolationLevel: param.isolationLevel,
                lattice:
                    param.defaultValue?._currentValue(context).value() ??
                    param.lattice ??
                    logSemanticError(
                        `Parameter ${param.varName} must have either an explicit value set or a default value.`,
                        { ...context, span: param.span, fatal: true },
                    ),
            })
            parameterScope.setCurrentValue(
                param.varName,
                param.defaultValue?._currentValue(context).value() ??
                    param.lattice ??
                    logSemanticError(
                        `Parameter ${param.varName} must have either a default value or an explicit value set.`,
                        { ...context, span: param.span, fatal: true },
                    ),
            )
        }
        return parameterScope
    }

    private resultLattice(context: Context): cir.Lattice | undefined {
        if (this.result) return this.result.lattice.toCIR()
        if (this.implementation.kind === 'implicit-return')
            return this.implementation.expression
                ._currentValue(context)
                .value()
                .toCIR()
    }

    private bodyContext(context: Context): Context {
        return {
            ...context,
            scope: context.scope.createChildScope(),
        }
    }
}
