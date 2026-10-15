import { BinaryOpExpression } from './binary-op-expression.js'
import { FunctionName } from './identfier.js'
import { Literal } from './literal.js'
import { MemoryExpression } from './memory-expression.js'
import { InterfaceSet, RCTypeSet, ValueSet } from './value-set.js'

export type Expression =
    | Literal
    | MemoryExpression
    | VariableReference
    | PropertyReference
    | FunctionCall
    | BinaryOpExpression

type VariableReference = {
    kind: 'VARIABLE_REF'
    name: string
    type: ValueSet
}

type PropertyReference = {
    kind: 'PROPERTY_REF'
    object: Expression
    property: string
    type: ValueSet
}

type FunctionCall = {
    kind: 'CALL'
    receiver?: Receiver
    name: FunctionName & { namespace?: string }
    arguments: Expression[]
    type: ValueSet
}

type Receiver =
    | {
          object: Expression & { type: RCTypeSet | InterfaceSet }
          dispatch: 'direct'
      }
    | {
          object: Expression & { type: RCTypeSet }
          dispatch: 'inherited'
      }
    | {
          object: Expression & { type: InterfaceSet }
          dispatch: 'conformance'
      }
