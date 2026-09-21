import { Result } from '@/tools/result'
import { SemanticResult } from '@/tools/semantic-result'
import { Context, Declaration, Expression } from '.'
import { DomainDeclaration } from './domain-declaration'
import { IsolationLevel } from './isolation-level'
import { TypeName } from './type-name'

export type DataField = {
    isImmutable: boolean
    name: string
    isolationLevel: IsolationLevel
    domain: DomainDeclaration
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

    emitDeclaration(context: Context): SemanticResult {
        context.scope.rootScope.addDataDeclaration(this)
        context.scope.rootScope.emitted.push({
            kind: 'RC_TYPE_DECL',
            name: this.name.name,
            namespace: this.name.namespace,
            fields: this.fields.map((field) => ({
                name: field.name,
                domain: field.domain!.toCIR(),
            })),
        })
        return Result.ok
    }
}
