import { Context, Declaration, Expression } from '.'
import { VariableSemantics } from './variable-declaration'
import { ExplicitValueSet } from './explicit-value-set'

export type DataField = {
    semantics: VariableSemantics
    name: string
    valueSet: ExplicitValueSet
    defaultValue?: Expression
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
            kind: 'TYPE_DECL',
            name: this.name,
            fields: this.fields.map((field) => ({
                name: field.name,
                valueSet: field.valueSet.toCIR(),
            })),
            methods: [],
        })
    }
}
