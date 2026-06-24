import { Statement, Declaration, Context } from '.'
import * as cir from '../cir'
import { DataDeclaration } from './data-declaration'

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
        this.declarations.forEach((decl) => {
            if (decl instanceof DataDeclaration) {
                context.scope.declarations.set(decl.name, decl)
            }
        })
        return {
            declarations: this.declarations.map((decl) => {
                if (decl instanceof DataDeclaration) {
                    return decl.toCIR(context)
                } else {
                    throw new Error('Unknown declaration type')
                }
            }),
            startBlock: this.main.map((stmt) => stmt.toCIR(context)),
        }
    }
}
