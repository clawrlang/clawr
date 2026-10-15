import { Declaration } from './declaration.js'
import { Statement } from './statement.js'

export type Module = {
    $schema: 'http://clawr.lang/schema/cir/DRAFT-0'
    startBlock?: Statement[]
    declarations?: Declaration[]
}

export { Declaration } from './declaration.js'
export { Expression } from './expression.js'
export { CanonicalName } from './identfier.js'
export { Statement } from './statement.js'
export { truthvalue, ValueSet } from './value-set.js'
