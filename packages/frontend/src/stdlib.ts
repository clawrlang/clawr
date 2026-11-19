import { Scope } from '@/model/scope'
import { parseProgram } from '@/program'
import { sources } from '@clawr/stdlib'

export function createStandardLibraryScope(): Scope {
    const scope = Scope.createRoot(undefined, 'clawr')
    parseProgram(sources, scope).toCIR({ scope })
    return scope
}
