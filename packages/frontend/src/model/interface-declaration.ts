import { Context, Declaration } from '@/model'
import { FunctionName } from '@/model/function-name'
import { Parameter } from '@/model/parameter'
import { TypeConstraintDeclaration } from '@/model/type-constraint-declaration'
import { TypeName } from '@/model/type-name'
import { RCTypeSet } from '@/model/value-set'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { mapFilter } from '@/tools/map-filter'
import { Result } from '@/tools/result'
import { SemanticErrorResult, SemanticResult } from '@/tools/source-result'
import { SourceError } from '@/tools'
import * as cir from '@clawr/cir'

type SignatureCIR = Extract<
    cir.Declaration,
    { kind: 'INTERFACE_DECL' }
>['methods'][number]

/** A method requirement of a `trait` or `role`: no implementation. */
export class MethodSignature {
    private constructor(
        public readonly baseName: string,
        public readonly parameters: Parameter[],
        public readonly result: TypeConstraintDeclaration | undefined,
        public readonly span: SourceCodeSpan,
    ) {}

    static create(config: {
        baseName: string
        parameters: Parameter[]
        result?: TypeConstraintDeclaration
        span: SourceCodeSpan
    }) {
        return new MethodSignature(
            config.baseName,
            config.parameters,
            config.result,
            config.span,
        )
    }

    name() {
        return FunctionName.create({
            baseName: this.baseName,
            arity: this.parameters.length,
            labels: mapFilter(this.parameters, (p) => p.label),
        })
    }

    usesSelf(): boolean {
        return [...this.parameters.map((p) => p.type), this.result].some(
            (type) => type instanceof RCTypeSet && type.type.name === 'Self',
        )
    }

    toCIR(context: Context, selfType?: TypeName): SemanticResult<SignatureCIR> {
        const untyped = this.parameters.find((p) => !p.type)
        if (untyped)
            return SemanticErrorResult.failure(
                `Parameter ${untyped.varName} of ${this.baseName} must have an explicit value set`,
                untyped.span,
            )
        const typeToCIR = (type: TypeConstraintDeclaration) =>
            type instanceof RCTypeSet && type.type.name === 'Self'
                ? RCTypeSet.create({
                      type: selfType ?? TypeName.create({ name: 'void' }),
                  }).toCIR()
                : context.scope.toCIRType(type)
        return Result.value({
            baseName: this.baseName,
            labels: mapFilter(this.parameters, (p) => p.label),
            parameters: this.parameters.map((p) => ({
                name: p.varName,
                type: typeToCIR(p.type!),
            })),
            returnType: this.result
                ? typeToCIR(this.result)
                : { universe: 'void' },
        })
    }
}

export class InterfaceDeclaration implements Declaration {
    private constructor(
        public readonly kind: 'trait' | 'role',
        public readonly name: TypeName,
        public readonly methods: MethodSignature[],
        public readonly span: SourceCodeSpan,
        public readonly nameSpan?: SourceCodeSpan,
        public readonly inherits: string[] = [],
    ) {}

    static create(config: {
        kind: 'trait' | 'role'
        name: TypeName
        methods: MethodSignature[]
        span: SourceCodeSpan
        nameSpan?: SourceCodeSpan
        inherits?: string[]
    }) {
        return new InterfaceDeclaration(
            config.kind,
            config.name,
            config.methods,
            config.span,
            config.nameSpan,
            config.inherits,
        )
    }

    /** Interfaces must be known before any object resolves its conformances. */
    readonly registrationPhase = 0

    hierarchy(context: Context): InterfaceDeclaration[] {
        const result: InterfaceDeclaration[] = []
        const visiting = new Set<InterfaceDeclaration>()
        const visit = (declaration: InterfaceDeclaration) => {
            if (visiting.has(declaration))
                throw SourceError.create({
                    message: `Cyclic interface inheritance involving ${declaration.name.name}`,
                    span: declaration.span,
                })
            if (result.includes(declaration)) return
            visiting.add(declaration)
            const seen = new Set<string>()
            for (const name of declaration.inherits) {
                const parent = context.scope.interfaceDeclaration(
                    TypeName.create({
                        name,
                        namespace: declaration.name.namespace,
                    }),
                )
                if (
                    !parent ||
                    parent.kind !== declaration.kind ||
                    seen.has(name)
                )
                    throw SourceError.create({
                        message: `Invalid ${declaration.kind} parent ${name}`,
                        span: declaration.span,
                    })
                seen.add(name)
                visit(parent)
            }
            visiting.delete(declaration)
            result.push(declaration)
        }
        visit(this)
        return result
    }

    resolvedMethods(context: Context): MethodSignature[] {
        const methods = new Map<string, MethodSignature>()
        for (const declaration of this.hierarchy(context)) {
            const ownNames = new Set<string>()
            for (const method of declaration.methods) {
                const key = method.name().toString()
                if (ownNames.has(key))
                    throw SourceError.create({
                        message: `Duplicate requirement ${key}`,
                        span: method.span,
                    })
                ownNames.add(key)
                const previous = methods.get(key)
                if (previous) {
                    const a = previous.toCIR(context)
                    const b = method.toCIR(context)
                    if (a.isError) throw a.error
                    if (b.isError) throw b.error
                    const signature = (m: SignatureCIR) =>
                        JSON.stringify([
                            m.parameters.map((p) => p.type),
                            m.returnType,
                        ])
                    if (
                        signature(a.value) !== signature(b.value) ||
                        JSON.stringify(
                            previous.parameters.map((p) => p.isolationLevel),
                        ) !==
                            JSON.stringify(
                                method.parameters.map((p) => p.isolationLevel),
                            )
                    )
                        throw SourceError.create({
                            message: `Conflicting inherited requirement ${key}`,
                            span: method.span,
                        })
                } else methods.set(key, method)
            }
        }
        return [...methods.values()]
    }

    method(name: FunctionName, context: Context): MethodSignature | undefined {
        return this.resolvedMethods(context).find(
            (m) => m.name().toString() === name.toString(),
        )
    }

    registerDeclaration(context: Context) {
        context.scope.rootScope.addInterfaceDeclaration(this)
    }

    emitDeclaration(context: Context): SemanticResult {
        const methodsResult = SemanticResult.collect(
            this.resolvedMethods(context).map((m) => m.toCIR(context)),
        )
        if (methodsResult.isError) return methodsResult
        context.scope.rootScope.emitted.push({
            kind: 'INTERFACE_DECL',
            name: this.name.name,
            namespace: this.name.namespace,
            methods: methodsResult.value,
        })
        return Result.ok
    }
}
