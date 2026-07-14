import * as cir from '../cir'
import { Context, Declaration } from '.'
import { VariableSemantics } from './variable-declaration'
import { convertSemantics } from './variable-reference'
import { ExplicitValueSet } from './explicit-value-set'

type DataField = {
    name: string
    valueSet: ExplicitValueSet
    semantics: VariableSemantics
}

export class DataDeclaration implements Declaration {
    private constructor(
        public name: string,
        public fields: DataField[],
    ) {}

    static create({
        name,
        fields,
    }: {
        name: string
        fields: DataField[]
    }): DataDeclaration {
        return new DataDeclaration(name, fields)
    }

    emitDeclaration(context: Context) {
        context.scope.rootScope.declarations.set(this.name, this)
        context.scope.rootScope.emitted.push({
            kind: 'DATA_DECL',
            name: this.name,
            fields: this.fields.map((field) => ({
                name: field.name,
                valueSet: field.valueSet.toCIR(),
            })),
        })
    }
}
