import { Statement } from '.'
import { ValueSet } from '../cir'

export class FunctionDeclaration {
    private constructor(
        public name: string,
        public parameters: Parameter[],
        public returnValueSet: ValueSet | undefined,
        public body: Statement[],
    ) {}

    static create({
        name,
        parameters,
        returnValueSet,
        body,
    }: {
        name: string
        parameters: Parameter[]
        returnValueSet: ValueSet | undefined
        body: Statement[]
    }): FunctionDeclaration {
        return new FunctionDeclaration(name, parameters, returnValueSet, body)
    }
}

export class Parameter {
    private constructor(
        public label: string | undefined,
        public varName: string,
        public type: string,
    ) {}

    static create({
        label,
        varName,
        type,
    }: {
        label: string | undefined
        varName: string
        type: string
    }): Parameter {
        return new Parameter(label, varName, type)
    }
}
