import { Scope } from '@/model/scope'
import { parseProgram } from '@/program'
import { sources } from '@clawr/stdlib'

export function createStandardLibraryScope(): Scope {
    const scope = Scope.createRoot(undefined, 'clawr')
    parseProgram(sources, scope, false).toCIR({ scope })
    return scope
}
