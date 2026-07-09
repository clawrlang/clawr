import { Statement } from '.'
import { ValueSet } from './value-set'

export class FunctionDeclaration {
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
