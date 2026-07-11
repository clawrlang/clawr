import * as cir from '../cir'
import { Context, Declaration, Expression, Statement } from '.'
import { ValueSet } from './value-set'
import { ReturnStatement } from './return-statement'
import { FunctionName } from './function-name'

export class FunctionDeclaration implements Declaration {
    private constructor(
        public baseName: string,
        public parameters: Parameter[],
        public result: ValueSet | undefined,
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
        result: ValueSet | undefined
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
            valueSet: param.valueSet.toCIR({
                ...context,
                semantics: 'COW',
            }),
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

        const returnValueSet = this.resultSet(context)

        const cirFuncDecl: cir.Declaration = {
            kind: 'FUNCTION_DECL',
            baseName: this.baseName,
            parameters,
            returnValueSet,
            body: bodyContext.scope.emitted,
        }
        context.scope.rootScope.emitted.push(cirFuncDecl)
    }

    resultSet(context: Context) {
        let returnValueSet = this.result?.toCIR({
            ...context,
            semantics: 'COW',
        })
        if (returnValueSet) return returnValueSet
        if (this.implementation.kind === 'implicit-return')
            return this.implementation.expression.toCIRExpression(
                this.bodyContext(context),
            ).valueSet
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
        public label: string | undefined,
        public varName: string,
        public valueSet: ValueSet,
    ) {}

    static create({
        label,
        varName,
        valueSet,
    }: {
        label: string | undefined
        varName: string
        valueSet: ValueSet
    }): Parameter {
        return new Parameter(label, varName, valueSet)
    }
}
