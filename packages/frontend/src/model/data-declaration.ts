import { Context, Declaration, Expression } from '@/model'
import { DomainDeclaration } from '@/model/domain-declaration'
import { IsolationLevel } from '@/model/isolation-level'
import { TypeName } from '@/model/type-name'
import { Result } from '@/tools/result'
import { SemanticResult } from '@/tools/source-result'

export type Property = {
    isImmutable: boolean
    name: string
    isolationLevel: IsolationLevel
    domain: DomainDeclaration
    defaultValue?: Expression
}

export class DataDeclaration implements Declaration {
    private constructor(
        public name: TypeName,
        public properties: Property[],
    ) {}

    static create({
        name,
        properties,
    }: {
        name: TypeName
        properties: Property[]
    }): DataDeclaration {
        return new DataDeclaration(name, properties)
    }

    emitDeclaration(context: Context): SemanticResult {
        context.scope.rootScope.addDataDeclaration(this)
        context.scope.rootScope.emitted.push({
            kind: 'RC_TYPE_DECL',
            name: this.name.name,
            namespace: this.name.namespace,
            properties: this.properties.map((property) => ({
                name: property.name,
                domain: property.domain!.toCIR(),
            })),
        })
        return Result.ok
    }
}
