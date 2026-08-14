import * as cir from '../cir'
import {
    Context,
    Declaration,
    Expression,
    ResolvedIsolationLevel,
    Statement,
} from '.'
import { ExplicitValueSet } from './explicit-value-set'
import { ReturnStatement } from './return-statement'
import { FunctionName } from './function-name'
import { Lattice } from './lattice'
import { SourceCodeSpan } from '../diagnostics'
import { logSemanticError } from './failable'
import { mapFilter } from '../tools/map-filter'

export class FunctionDeclaration implements Declaration {
    private constructor(
        public baseName: string,
        public parameters: Parameter[],
        public result: ExplicitValueSet | undefined,
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
        result: ExplicitValueSet | undefined
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

    resultLattice(context: Context): Lattice | undefined {
        if (this.result) return this.result.toLattice(context)
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

        const parameters = this.parameters.map((param) => ({
            label: param.label,
            varName: param.varName,
            valueSet: param.valueSet!.toCIR(),
        }))

        const parameterScope = context.scope.createChildScope()
        for (const param of this.parameters) {
            parameterScope.variables.set(param.varName, {
                isImmutable: param.isImmutable,
                isolationLevel: param.isolationLevel,
                lattice:
                    param.defaultValue?.currentValue(context).value() ??
                    param.valueSet?.toLattice(context) ??
                    logSemanticError(
                        `Parameter ${param.varName} must have either an explicit value set or a default value.`,
                        { ...context, span: param.span, fatal: true },
                    ),
            })
            parameterScope.setCurrentValue(
                param.varName,
                param.defaultValue?.currentValue(context).value() ??
                    param.valueSet?.toLattice(context) ??
                    logSemanticError(
                        `Parameter ${param.varName} must have either a default value or an explicit value set.`,
                        { ...context, span: param.span, fatal: true },
                    ),
            )
        }

        const bodyContext = this.bodyContext({
            ...context,
            scope: parameterScope,
        })

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
            parameters,
            resultValueSet,
            body: bodyContext.scope.emitted,
        }
        context.scope.rootScope.emitted.push(cirFuncDecl)
    }

    private resultSet(context: Context): cir.ValueSet | undefined {
        let resultValueSet = this.result?.toCIR()
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

export class Parameter {
    private constructor(
        public isImmutable: boolean,
        public isolationLevel: ResolvedIsolationLevel,
        public label: string | undefined,
        public varName: string,
        public span: SourceCodeSpan,
        public valueSet?: ExplicitValueSet,
        public defaultValue?: Expression,
    ) {}

    static create({
        isImmutable,
        isolationLevel,
        label,
        varName,
        valueSet,
        defaultValue,
        span,
    }: {
        label: string | undefined
        varName: string
        valueSet?: ExplicitValueSet
        isImmutable: boolean
        isolationLevel: ResolvedIsolationLevel
        defaultValue?: Expression
        span: SourceCodeSpan
    }): Parameter {
        return new Parameter(
            isImmutable,
            isolationLevel,
            label,
            varName,
            span,
            valueSet,
            defaultValue,
        )
    }
}
