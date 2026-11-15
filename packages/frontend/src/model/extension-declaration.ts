import { Context, Declaration } from '@/model'
import { FunctionDeclaration } from '@/model/function-declaration'
import { TypeName } from '@/model/type-name'
import { Result } from '@/tools/result'
import { SemanticResult } from '@/tools/source-result'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { SourceError } from '@/tools'

export class ExtensionDeclaration implements Declaration {
    readonly registrationPhase = 2

    private constructor(
        public readonly target: TypeName,
        public readonly conformance: TypeName | undefined,
        public readonly methods: FunctionDeclaration[],
        public readonly mutating: FunctionDeclaration[],
        public readonly span: SourceCodeSpan,
    ) {}

    static create(config: {
        target: TypeName
        conformance?: TypeName
        methods: FunctionDeclaration[]
        mutating: FunctionDeclaration[]
        span: SourceCodeSpan
    }) {
        return new ExtensionDeclaration(
            config.target,
            config.conformance,
            config.methods,
            config.mutating,
            config.span,
        )
    }

    registerDeclaration(context: Context): void {
        const data = context.scope.rootScope.dataDeclaration(this.target)
        const object = context.scope.rootScope.objectDeclaration(this.target)
        if (!data && !object)
            throw SourceError.create({
                message: `Unknown extension target ${this.target.name}`,
                span: this.span,
            })

        const iface = this.conformance
            ? context.scope.interfaceDeclaration(this.conformance)
            : undefined
        if (this.conformance && !iface)
            throw SourceError.create({
                message: `${this.conformance.name} is not a trait or role`,
                span: this.span,
            })
        if (iface?.kind === 'trait' && object?.isService())
            throw SourceError.create({
                message: `Service ${this.target.name} cannot conform to trait ${iface.name.name}; use a role`,
                span: this.span,
            })
        if (object?.isService() && this.mutating.length)
            throw SourceError.create({
                message: `Service ${this.target.name} cannot have mutating extension methods`,
                span: this.span,
            })

        const previous = context.scope.rootScope.extensionDeclarations(
            this.target,
        )
        if (
            this.conformance &&
            previous.some(
                (extension) =>
                    extension.conformance?.canonical() ===
                    this.conformance?.canonical(),
            )
        )
            throw SourceError.create({
                message: `${this.target.name} conforms to ${this.conformance.name} more than once`,
                span: this.span,
            })

        const methods = [...this.methods, ...this.mutating]
        const names = new Set<string>()
        for (const method of methods) {
            const name = method.name().toString()
            if (data && name === 'toJSON()')
                throw SourceError.create({
                    message:
                        'A data type must define its JSON serializer in the serialize: section',
                    span: method.span ?? this.span,
                })
            const inheritedMemberConflict =
                !!object &&
                context.scope.rootScope
                    .objectDeclarations()
                    .some(
                        (candidate) =>
                            candidate !== object &&
                            candidate.isSubtypeOf(object.name, context) &&
                            !!candidate.method(method.name()),
                    )
            const inheritedExtensionConflict =
                !!object &&
                context.scope.rootScope
                    .allExtensionDeclarations()
                    .some((extension) => {
                        const candidate =
                            context.scope.rootScope.objectDeclaration(
                                extension.target,
                            )
                        return (
                            !!candidate &&
                            candidate !== object &&
                            (candidate.isSubtypeOf(object.name, context) ||
                                object.isSubtypeOf(candidate.name, context)) &&
                            [...extension.methods, ...extension.mutating].some(
                                (existing) =>
                                    existing.name().toString() === name,
                            )
                        )
                    })
            if (
                names.has(name) ||
                previous.some((extension) =>
                    [...extension.methods, ...extension.mutating].some(
                        (existing) => existing.name().toString() === name,
                    ),
                ) ||
                object?.lookupMethod(method.name(), context) ||
                data?.lookupMethod(method.name(), context) ||
                inheritedMemberConflict ||
                inheritedExtensionConflict
            )
                throw SourceError.create({
                    message: `Duplicate extension method ${this.target.name}.${name}`,
                    span: method.span ?? this.span,
                })
            names.add(name)
        }

        context.scope.rootScope.addExtensionDeclaration(this)
    }

    emitDeclaration(_context: Context): SemanticResult {
        return Result.ok
    }
}
