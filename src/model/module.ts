import * as cir from '../cir'
import { Context, Declaration, Statement } from '.'
import { Failable } from './gen-failable'
import { _Failable } from './failable'

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
        const self = this
        const result = Failable.do(function* () {
            for (const decl of self.declarations)
                yield yield* decl.emitDeclaration(context)
            for (const stmt of self.main)
                yield yield* stmt.emitStatement(context)
            return Failable.success(undefined)
        })
        _Failable.of(result).throwIfFailure()
        return {
            $schema: 'http://clawr.lang/schema/cir/DRAFT-0',
            declarations: context.scope.rootScope.emitted,
            startBlock: context.scope.emitted,
        }
    }
}
