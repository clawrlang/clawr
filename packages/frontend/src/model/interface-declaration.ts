import { Context, Declaration } from '@/model'
import { FunctionName } from '@/model/function-name'
import { Parameter } from '@/model/parameter'
import { TypeConstraintDeclaration } from '@/model/type-constraint-declaration'
import { TypeName } from '@/model/type-name'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { mapFilter } from '@/tools/map-filter'
import { Result } from '@/tools/result'
import { SemanticErrorResult, SemanticResult } from '@/tools/source-result'
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

    toCIR(): SemanticResult<SignatureCIR> {
        const untyped = this.parameters.find((p) => !p.type)
        if (untyped)
            return SemanticErrorResult.failure(
                `Parameter ${untyped.varName} of ${this.baseName} must have an explicit value set`,
                untyped.span,
            )
        return Result.value({
            baseName: this.baseName,
            labels: mapFilter(this.parameters, (p) => p.label),
            parameters: this.parameters.map((p) => ({
                name: p.varName,
                type: p.type!.toCIR(),
            })),
            returnType: this.result?.toCIR() ?? { universe: 'void' },
        })
    }
}

export class InterfaceDeclaration implements Declaration {
    private constructor(
        public readonly kind: 'trait' | 'role',
        public readonly name: TypeName,
        public readonly methods: MethodSignature[],
        public readonly span: SourceCodeSpan,
    ) {}

    static create(config: {
        kind: 'trait' | 'role'
        name: TypeName
        methods: MethodSignature[]
        span: SourceCodeSpan
    }) {
        return new InterfaceDeclaration(
            config.kind,
            config.name,
            config.methods,
            config.span,
        )
    }

    /** Interfaces must be known before any object resolves its conformances. */
    readonly registrationPhase = 0

    method(name: FunctionName): MethodSignature | undefined {
        return this.methods.find((m) => m.name().toString() === name.toString())
    }

    registerDeclaration(context: Context) {
        context.scope.rootScope.addInterfaceDeclaration(this)
    }

    emitDeclaration(context: Context): SemanticResult {
        const methodsResult = SemanticResult.collect(
            this.methods.map((m) => m.toCIR()),
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
