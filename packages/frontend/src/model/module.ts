import { Context, Declaration, Statement } from '@/model'
import { SemanticResult } from '@/tools/source-result'
import * as cir from '@clawr/cir'

export class Module {
    private constructor(
        private main: Statement[],
        private declarations: Declaration[],
    ) {}

    static create({
        main,
        declarations,
    }: {
        main?: Statement[]
        declarations?: Declaration[]
    }): Module {
        return new Module(main ?? [], declarations ?? [])
    }

    toCIR(context: Context): cir.Module {
        const declarationsInPhaseOrder = [...this.declarations].sort(
            (a, b) => (a.registrationPhase ?? 1) - (b.registrationPhase ?? 1),
        )
        for (const decl of declarationsInPhaseOrder)
            decl.registerDeclaration?.(context)
        const result = SemanticResult.collect([
            ...this.declarations.map((decl) => decl.emitDeclaration(context)),
            ...this.main.map((stmt) => stmt.emitStatement(context)),
        ])
        if (result.isError) throw result.error
        if (this.main.length) context.scope.releaseVariables()
        return {
            $schema: 'http://clawr.lang/schema/cir/DRAFT-0',
            declarations: context.scope.rootScope.emitted,
            startBlock: context.scope.emitted,
        }
    }
}
