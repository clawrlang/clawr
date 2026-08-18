import * as cir from '../cir'
import { Context, Declaration, Expression, Statement } from '.'
import { AnyIsolationLevel, IsolationLevel, UNIQUE } from './isolation-level'
import { ExplicitValueSet } from './explicit-value-set'
import { ReturnStatement } from './return-statement'
import { FunctionName } from './function-name'
import { Lattice } from './lattice'
import { Failable, logSemanticError } from './failable'
import { mapFilter } from '../tools/map-filter'
import { Parameter } from './parameter'
import { Scope } from './scope'

export class FunctionDeclaration implements Declaration {
    private constructor(
        public baseName: string,
        public parameters: Parameter[],
        public result:
            | (ExplicitValueSet & { isolationLevel: IsolationLevel | UNIQUE })
            | undefined,
        public implementation:
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
            | (ExplicitValueSet & { isolationLevel: IsolationLevel | UNIQUE })
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

    resultIsolationLevel(context: Context): Failable<AnyIsolationLevel> {
        if (this.result) return Failable.success(this.result.isolationLevel)
        if (this.implementation.kind === 'implicit-return')
            return this.implementation.expression.isolationLevel(context)
        else
            throw new Error(
                `unable to infer isolation level for ${this.baseName}`,
            )
    }

    resultLattice(context: Context): Lattice | undefined {
        if (this.result?.lattice) return this.result.lattice
        if (this.implementation.kind === 'implicit-return')
            return this.implementation.expression
                .currentValue(this.bodyContext(context))
                .value()
    }

    emitDeclaration(context: Context) {
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
                : [ReturnStatement.create(this.implementation.expression)]

        for (const stmt of body) stmt.emitStatement(bodyContext)

        if (
            this.implementation.kind === 'body' &&
            !body.some((stmt) => stmt instanceof ReturnStatement)
        )
            bodyContext.scope.releaseVariables()

        const resultValueSet = this.resultSet(bodyContext)

        const cirFuncDecl: cir.Declaration = {
            kind: 'FUNCTION_DECL',
            baseName: this.baseName,
            labels: mapFilter(this.parameters, (p) => p.label),
            parameters: this.parameters.map((param) => ({
                name: param.varName,
                valueSet: param.valueSet!.lattice!.toCIR(),
            })),
            resultValueSet,
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
            calleeResult: this.result?.lattice
                ? this.result
                : this.implementation.kind === 'body'
                  ? undefined
                  : {
                        isolationLevel: this.implementation.expression
                            .isolationLevel(contextWithParameters)
                            .value() as IsolationLevel,
                        lattice: this.implementation.expression
                            .currentValue(contextWithParameters)
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
                isolationLevel: param.valueSet.isolationLevel,
                lattice:
                    param.defaultValue?.currentValue(context).value() ??
                    param.valueSet?.lattice ??
                    logSemanticError(
                        `Parameter ${param.varName} must have either an explicit value set or a default value.`,
                        { ...context, span: param.span, fatal: true },
                    ),
            })
            parameterScope.setCurrentValue(
                param.varName,
                param.defaultValue?.currentValue(context).value() ??
                    param.valueSet?.lattice ??
                    logSemanticError(
                        `Parameter ${param.varName} must have either a default value or an explicit value set.`,
                        { ...context, span: param.span, fatal: true },
                    ),
            )
        }
        return parameterScope
    }

    private resultSet(context: Context): cir.ValueSet | undefined {
        let resultValueSet = this.result?.lattice?.toCIR()
        if (resultValueSet) return resultValueSet
        if (this.implementation.kind === 'implicit-return')
            return this.implementation.expression
                .currentValue(context)
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
