import * as cir from '../cir'
import { Context, Declaration, Expression, Statement } from '.'
import { ExplicitRCTypeValueSet, ExplicitValueSet } from './explicit-value-set'
import { ReturnStatement } from './return-statement'
import { FunctionName } from './function-name'
import { CowTypeLattice, Lattice, RefTypeLattice } from './lattice'
import { VariableSemantics } from './variable-declaration'

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
            return this.implementation.expression.currentValue(
                this.bodyContext(context),
            )
    }

    emitDeclaration(context: Context) {
        const name = FunctionName.create({
            baseName: this.baseName,
            arity: this.parameters.length,
            labels: this.parameters
                .filter((param) => param.label)
                .map((param) => param.label!),
        })
        context.scope.rootScope.declarations.set(name.toString(), this)

        const parameters = this.parameters.map((param) => ({
            label: param.label,
            varName: param.varName,
            valueSet: param.valueSet!.toCIR(),
        }))

        const bodyContext = this.bodyContext(context)

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

        const resultValueSet = this.resultSet(context)

        const cirFuncDecl: cir.Declaration = {
            kind: 'FUNCTION_DECL',
            baseName: this.baseName,
            parameters,
            resultValueSet,
            body: bodyContext.scope.emitted,
        }
        context.scope.rootScope.emitted.push(cirFuncDecl)
    }

    resultSet(context: Context) {
        let resultValueSet = this.result?.toCIR()
        if (resultValueSet) return resultValueSet
        if (this.implementation.kind === 'implicit-return')
            return this.implementation.expression.toCIRExpression(
                this.bodyContext(context),
            ).valueSet
    }

    private bodyContext(context: Context): Context {
        if (!this.result && this.implementation.kind === 'implicit-return') {
            const inferredLattice =
                this.implementation.expression.currentValue(context)
            return {
                ...context,
                ...{
                    semantics:
                        inferredLattice instanceof CowTypeLattice
                            ? 'const'
                            : inferredLattice instanceof RefTypeLattice
                              ? 'ref'
                              : undefined,
                },
                scope: context.scope.createChildScope(),
            }
        }

        if (!(this.result instanceof ExplicitRCTypeValueSet))
            return {
                ...context,
                scope: context.scope.createChildScope(),
            }

        return {
            ...context,
            ...{ semantics: this.result.semantics },
            scope: context.scope.createChildScope(),
        }
    }
}

export class Parameter {
    private constructor(
        public semantics: VariableSemantics | undefined,
        public label: string | undefined,
        public varName: string,
        public valueSet?: ExplicitValueSet,
        public defaultValue?: Expression,
    ) {}

    static create({
        semantics,
        label,
        varName,
        valueSet,
        defaultValue,
    }: {
        label: string | undefined
        varName: string
        valueSet?: ExplicitValueSet
        semantics?: VariableSemantics
        defaultValue?: Expression
    }): Parameter {
        return new Parameter(semantics, label, varName, valueSet, defaultValue)
    }
}
