import * as cir from '../cir'
import { Context, Declaration } from '.'
import { VariableSemantics } from './variable-declaration'

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

    toCIR(_: Context): cir.Declaration {
        return {
            kind: 'DATA_DECL',
            name: this.name,
            fields: this.fields.map((field) => ({
                name: field.name,
                type: field.type,
            })),
        }
    }
}
