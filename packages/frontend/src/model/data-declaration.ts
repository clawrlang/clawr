import { Context, Declaration, Expression } from '@/model'
import { FunctionDeclaration } from '@/model/function-declaration'
import { IsolationLevel } from '@/model/isolation-level'
import { TypeConstraintDeclaration } from '@/model/type-constraint-declaration'
import { TypeName } from '@/model/type-name'
import {
    IntegerSet,
    RCTypeSet,
    RealSet,
    StringSet,
    TruthvalueSet,
} from '@/model/value-set'
import { Result } from '@/tools/result'
import { SemanticErrorResult, SemanticResult } from '@/tools/source-result'
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
        public readonly explicitlySerializable: boolean,
        public readonly serializer: FunctionDeclaration | undefined,
        public readonly span?: SourceCodeSpan,
    ) {}

    static create({
        name,
        properties,
        explicitlySerializable,
        serializer,
        span,
    }: {
        name: TypeName
        properties: Property[]
        explicitlySerializable?: boolean
        serializer?: FunctionDeclaration
        span?: SourceCodeSpan
    }): DataDeclaration {
        return new DataDeclaration(
            name,
            properties,
            explicitlySerializable ?? false,
            serializer,
            span,
        )
    }

    registerDeclaration(context: Context): void {
        context.scope.rootScope.addDataDeclaration(this)
    }

    conformsTo(name: TypeName, context: Context): boolean {
        const serializable = context.scope.interfaceDeclaration(
            TypeName.create({
                name: 'JSONSerializable',
                namespace: 'clawr',
            }),
        )
        return (
            !!serializable &&
            name.canonical() === serializable.name.canonical() &&
            (this.implicitlyJSONSerializable(context, new Set()) ||
                (this.explicitlySerializable && !!this.serializer))
        )
    }

    emitDeclaration(context: Context): SemanticResult {
        context.scope.rootScope.addDataDeclaration(this)
        if (
            this.explicitlySerializable &&
            !this.serializer &&
            !this.implicitlyJSONSerializable(context, new Set())
        )
            return SemanticErrorResult.failure(
                'A data type with non-serializable properties must define serialize: toJSON()',
                this.span ?? {
                    start: { line: 1, column: 1 },
                    end: { line: 1, column: 1 },
                },
            )
        if (this.serializer && !this.explicitlySerializable)
            return SemanticErrorResult.failure(
                'A custom data serializer requires JSONSerializable conformance',
                this.serializer.span ??
                    this.span ?? {
                        start: { line: 1, column: 1 },
                        end: { line: 1, column: 1 },
                    },
            )
        if (this.serializer && !this.isValidSerializer(context))
            return SemanticErrorResult.failure(
                'A data serializer must be a non-extern toJSON() method returning string',
                this.serializer.span ??
                    this.span ?? {
                        start: { line: 1, column: 1 },
                        end: { line: 1, column: 1 },
                    },
            )
        if (this.serializer) {
            const serializerContext = context.scope.createChildScope()
            serializerContext.addSelfVariable(this.name)
            const method = this.serializer.emitMethod({
                ...context,
                scope: serializerContext,
            })
            if (method.isError) return method
            context.scope.rootScope.emitted.push({
                kind: 'RC_TYPE_DECL',
                name: this.name.name,
                namespace: this.name.namespace,
                methods: [method.value],
                initializers: [],
                conformances: [
                    {
                        interface: {
                            name: 'JSONSerializable',
                            namespace: 'clawr',
                        },
                        fulfillments: [
                            {
                                requirement: {
                                    baseName: 'toJSON',
                                    labels: [],
                                },
                                implementation: {
                                    baseName: 'toJSON',
                                    labels: [],
                                },
                            },
                        ],
                    },
                ],
                properties: this.properties.map((property) => ({
                    name: property.name,
                    type: context.scope.toCIRType(property.type),
                })),
            })
            return Result.ok
        }
        const serializable = this.conformsTo(
            TypeName.create({
                name: 'JSONSerializable',
                namespace: 'clawr',
            }),
            context,
        )
        context.scope.rootScope.emitted.push({
            kind: 'RC_TYPE_DECL',
            name: this.name.name,
            namespace: this.name.namespace,
            ...(serializable && {
                conformances: [
                    {
                        interface: {
                            name: 'JSONSerializable',
                            namespace: 'clawr',
                        },
                        fulfillments: [
                            {
                                requirement: {
                                    baseName: 'toJSON',
                                    labels: [],
                                },
                                implementation: {
                                    baseName: 'toJSON',
                                    labels: [],
                                },
                            },
                        ],
                    },
                ],
            }),
            properties: this.properties.map((property) => ({
                name: property.name,
                type: context.scope.toCIRType(property.type!),
            })),
        })
        return Result.ok
    }

    private isValidSerializer(context: Context): boolean {
        if (!this.serializer || this.serializer.name().toString() !== 'toJSON()')
            return false
        if (this.serializer.parameters.length !== 0 || !this.serializer.result)
            return false
        return (
            this.serializer.result.type instanceof StringSet &&
            this.serializer.result.isolationLevel !== 'SHARED' &&
            context.scope.interfaceDeclaration(
                TypeName.create({
                    name: 'JSONSerializable',
                    namespace: 'clawr',
                }),
            ) !== undefined
        )
    }

    private implicitlyJSONSerializable(
        context: Context,
        visiting: Set<DataDeclaration>,
    ): boolean {
        if (visiting.has(this)) return true
        visiting.add(this)
        const result = this.properties.every((property) => {
            if (property.isolationLevel === 'SHARED') return false
            const type = property.type
            if (
                type instanceof IntegerSet ||
                type instanceof RealSet ||
                type instanceof TruthvalueSet ||
                type instanceof StringSet
            )
                return true
            if (type instanceof RCTypeSet) {
                const nested = context.scope.dataDeclaration(type.type)
                return (
                    !!nested &&
                    nested.implicitlyJSONSerializable(context, visiting)
                )
            }
            return false
        })
        visiting.delete(this)
        return result
    }
}
