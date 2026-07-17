import { ErrorReporter } from '../diagnostics'

export type Context = {
    errorReporter: ErrorReporter
    type?: string
    semantics?: 'SHARED' | 'ISOLATED'
}

export { ModuleParser } from './module-parser'
