import { Expression } from './expression.js'
import { CanonicalName, FunctionName } from './identfier.js'
import { Statement } from './statement.js'
import { ValueSet } from './value-set.js'

export type Declaration =
    | VariableDeclaration
    | FunctionDeclaration
    | RCTypeDeclaration
    | InterfaceDeclaration

type InterfaceDeclaration = {
    kind: 'INTERFACE_DECL'
    name: string
    namespace?: string
    methods: FunctionSignature[]
}

export type VariableDeclaration = {
    kind: 'VARIABLE_DECL'
    name: string
    namespace?: string
    type: ValueSet
    initialValue: Expression
}

type FunctionDeclaration = {
    kind: 'FUNCTION_DECL'
    body: Statement[]
    namespace?: string
} & FunctionSignature

type FunctionSignature = {
    baseName: string
    labels: string[]
    parameters: {
        name: string
        type: ValueSet
    }[]
    returnType: ValueSet | { universe: 'void' }
}

type RCTypeDeclaration = {
    // `data` only supports these
    kind: 'RC_TYPE_DECL'
    name: string
    namespace?: string
    properties: {
        name: string
        type: ValueSet
    }[]
    conformances?: {
        interface: CanonicalName
        fulfillments: {
            requirement: FunctionName
            implementation: FunctionName
        }[]
    }[]
} & (
    | {
          base?: CanonicalName
          methods: FunctionDeclaration[]
          initializers: (FunctionDeclaration & {
              returnType: { universe: 'void' }
          })[]
          dispatchTable?: {
              slot: FunctionSignature
              declaredIn: CanonicalName
              implementation?: CanonicalName
          }[]
      }
    | {}
)
