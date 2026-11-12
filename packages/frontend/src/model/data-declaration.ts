import { Context, Declaration, Expression } from '@/model'
import { IsolationLevel } from '@/model/isolation-level'
import { TypeConstraintDeclaration } from '@/model/type-constraint-declaration'
import { TypeName } from '@/model/type-name'
import { Result } from '@/tools/result'
import { SemanticResult } from '@/tools/source-result'
import { SourceCodeSpan } from '@/tools/diagnostics'

export type Property = {
    isImmutable: boolean
    name: string
    isolationLevel: IsolationLevel
    type: TypeConstraintDeclaration
    defaultValue?: Expression
}

export class DataDeclaration implements Declaration {
    private constructor(
        public name: TypeName,
        public properties: Property[],
        public readonly span?: SourceCodeSpan,
    ) {}

    static create({
        name,
        properties,
        span,
    }: {
        name: TypeName
        properties: Property[]
        span?: SourceCodeSpan
    }): DataDeclaration {
        return new DataDeclaration(name, properties, span)
    }

    registerDeclaration(context: Context): void {
        context.scope.rootScope.addDataDeclaration(this)
    }

    emitDeclaration(context: Context): SemanticResult {
        context.scope.rootScope.addDataDeclaration(this)
        context.scope.rootScope.emitted.push({
            kind: 'RC_TYPE_DECL',
            name: this.name.name,
            namespace: this.name.namespace,
            properties: this.properties.map((property) => ({
                name: property.name,
                type: context.scope.toCIRType(property.type!),
            })),
        })
        return Result.ok
    }
}
