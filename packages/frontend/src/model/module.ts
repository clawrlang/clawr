import { Context, Declaration, Statement } from '@/model'
import { SemanticResult } from '@/tools/source-result'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { VariableDeclaration } from '@/model/variable-declaration'
import * as cir from '@clawr/cir'

export class Module {
    private constructor(
        public readonly main: Statement[] | undefined,
        public readonly declarations: Declaration[],
        public readonly mainSpan?: SourceCodeSpan,
    ) {}

    static create({
        main,
        declarations,
        mainSpan,
    }: {
        main?: Statement[]
        declarations?: Declaration[]
        mainSpan?: SourceCodeSpan
    }): Module {
        return new Module(main, declarations ?? [], mainSpan)
    }

    registerDeclarations(context: Context): void {
        const declarationsInPhaseOrder = [...this.declarations].sort(
            (a, b) => (a.registrationPhase ?? 1) - (b.registrationPhase ?? 1),
        )
        for (const decl of declarationsInPhaseOrder)
            decl.registerDeclaration?.(context)
    }

    toCIR(context: Context): cir.Module {
        this.registerDeclarations(context)
        const result = SemanticResult.collect([
            ...[...this.declarations]
                .sort(
                    (a, b) =>
                        Number(b instanceof VariableDeclaration) -
                        Number(a instanceof VariableDeclaration),
                )
                .map((decl) => decl.emitDeclaration(context)),
            ...(this.main ?? []).map((stmt) =>
                stmt.emitStatement({ ...context, returnScope: context.scope }),
            ),
        ])
        if (result.isError) throw result.error
        if (this.main?.length) context.scope.releaseVariables()
        return {
            $schema: 'http://clawr.lang/schema/cir/DRAFT-0',
            declarations: context.scope.rootScope.emitted,
            startBlock: context.scope.emitted,
        }
    }
}
