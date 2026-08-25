import { Context, Declaration, Expression } from '.'
import { LatticeDeclaration } from './lattice-declaration'
import { IsolationLevel } from './isolation-level'
import { TypeName } from './type-name'

export type DataField = {
    isImmutable: boolean
    name: string
    isolationLevel: IsolationLevel
    lattice: LatticeDeclaration
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

    _emitDeclaration(context: Context) {
        context.scope.rootScope.addDataDeclaration(this)
        context.scope.rootScope.emitted.push({
            kind: 'RC_TYPE_DECL',
            name: this.name.name,
            namespace: this.name.namespace,
            fields: this.fields.map((field) => ({
                name: field.name,
                lattice: field.lattice!.toCIR(),
            })),
        })
    }
}
