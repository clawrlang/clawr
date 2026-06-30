import { ErrorReporter } from '../diagnostics'

export type Context = {
    errorReporter: ErrorReporter
    type?: string
    semantics?: 'REF' | 'COW'
}

export { ModuleParser } from './module-parser'
