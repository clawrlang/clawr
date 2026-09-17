import * as cir from '@/cir'
import { isFailure, Result } from '@/tools/result'
import { SemanticErrorCollection } from '@/tools/semantic-error'
import { Context, Declaration, Statement } from '.'

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

    toCIR(context: Context): cir.ClawrModule {
        const result = Result.collect([
            ...this.declarations.map((decl) => decl.emitDeclaration(context)),
            ...this.main.map((stmt) => stmt.emitStatement(context)),
        ])
        if (isFailure(result))
            throw SemanticErrorCollection.create(result.errors)
        return {
            $schema: 'http://clawr.lang/schema/cir/DRAFT-0',
            declarations: context.scope.rootScope.emitted,
            startBlock: context.scope.emitted,
        }
    }
}
