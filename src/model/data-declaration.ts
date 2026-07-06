import * as cir from '../cir'
import { Context, Declaration } from '.'
import { VariableSemantics } from './variable-declaration'
import { convertSemantics } from './variable-reference'

type DataField = {
    name: string
    type: string
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
                valueSet: buildValueSet(field),
            })),
        })
    }
}

function buildValueSet(field: DataField): cir.ValueSet {
    switch (field.type) {
        case 'integer':
            return { type: 'integer' }
        case 'truthvalue':
            return { type: 'truthvalue' }
        case 'string':
            return { type: 'string' }
        default:
            return {
                type: 'rc-type',
                typeName: field.type,
                semantics: convertSemantics(field.semantics),
            }
    }
}
