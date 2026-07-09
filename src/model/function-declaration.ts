import * as cir from '../cir'
import { Context, Declaration, Statement } from '.'
import { ValueSet } from './value-set'

export class FunctionDeclaration implements Declaration {
    private constructor(
        public name: string,
        public parameters: Parameter[],
        public result: ValueSet | undefined,
        public body: Statement[],
    ) {}

    static create({
        name,
        parameters,
        result,
        body,
    }: {
        name: string
        parameters: Parameter[]
        result: ValueSet | undefined
        body: Statement[]
    }): FunctionDeclaration {
        return new FunctionDeclaration(name, parameters, result, body)
    }

    emitDeclaration(context: Context) {
        context.scope.rootScope.declarations.set(this.name, this)

        const parameters = this.parameters.map((param) => ({
            label: param.label,
            name: param.varName,
            valueSet: param.valueSet.toCIR({
                ...context,
                semantics: 'COW',
            }),
        }))

        const returnValueSet = this.result?.toCIR({
            ...context,
            semantics: 'COW',
        })

        const bodyContext = {
            ...context,
            scope: context.scope.createChildScope(),
        }

        for (const stmt of this.body) stmt.emitStatement(bodyContext)

        const cirFuncDecl: cir.Declaration = {
            kind: 'FUNCTION_DECL',
            name: this.name,
            parameters,
            returnValueSet,
            body: bodyContext.scope.emitted,
        }
        context.scope.rootScope.emitted.push(cirFuncDecl)
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
