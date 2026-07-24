import { Context, Declaration } from '.'
import { VariableSemantics } from './variable-declaration'
import { ExplicitValueSet } from './explicit-value-set'

type DataField = {
    name: string
    valueSet: ExplicitValueSet
    semantics: VariableSemantics
}

export class TypeDeclaration implements Declaration {
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
    }): TypeDeclaration {
        return new TypeDeclaration(name, fields)
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
        })
    }
}
