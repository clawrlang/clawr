import * as cir from '../cir'
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
        for (const decl of this.declarations) decl._emitDeclaration(context)
        for (const stmt of this.main) stmt._emitStatement(context)
        return {
            $schema: 'http://clawr.lang/schema/cir/DRAFT-0',
            declarations: context.scope.rootScope.emitted,
            startBlock: context.scope.emitted,
        }
    }
}
