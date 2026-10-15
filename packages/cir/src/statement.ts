import { VariableDeclaration } from './declaration.js'
import { Expression } from './expression.js'
import { Storage } from './memory-expression.js'
import { RCTypeSet } from './value-set.js'

export type Statement =
    | EnsureUnique
    | Release
    | FunctionCall
    | Return
    | VariableDeclaration
    | Assign
    | SelfInitialization

type FunctionCall = Omit<Extract<Expression, { kind: 'CALL' }>, 'type'>

type EnsureUnique = {
    kind: 'ENSURE_UNIQUE'
    object: Storage
}

type Release = {
    kind: 'RELEASE'
    object: Storage
}

type Return = {
    kind: 'RETURN'
    value?: Expression
}

type Assign = {
    kind: 'ASSIGN'
    target: Storage
    value: Expression
}

type SelfInitialization = {
    kind: 'SELF_INIT'
    type: RCTypeSet
    properties: {
        name: string
        value: Expression
    }[]
}
