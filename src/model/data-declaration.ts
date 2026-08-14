import { Context, Declaration, Expression } from '.'
import { ExplicitValueSet } from './explicit-value-set'
import { TypeName } from './type-name'

export type DataField = {
    isImmutable: boolean
    name: string
    valueSet: ExplicitValueSet
    defaultValue?: Expression
}

export class DataDeclaration implements Declaration {
    private constructor(
        public name: TypeName,
        public fields: DataField[],
    ) {}

    static create({
        name,
        fields,
    }: {
        name: TypeName
        fields: DataField[]
    }): DataDeclaration {
        return new DataDeclaration(name, fields)
    }

    emitDeclaration(context: Context) {
        context.scope.rootScope.addDataDeclaration(this.name, this)
        context.scope.rootScope.emitted.push({
            kind: 'TYPE_DECL',
            name: this.name.name,
            namespace: this.name.namespace,
            fields: this.fields.map((field) => ({
                name: field.name,
                valueSet: field.valueSet.toCIR(),
            })),
        })
    }
}
