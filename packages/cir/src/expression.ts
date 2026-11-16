import { BinaryOpExpression } from './binary-op-expression.js'
import { FunctionName } from './identfier.js'
import { Literal } from './literal.js'
import { MemoryExpression } from './memory-expression.js'
import { FieldSet, InterfaceSet, RCTypeSet, ValueSet } from './value-set.js'
import { Statement } from './statement.js'

export type Expression =
    | Literal
    | MemoryExpression
    | VariableReference
    | PropertyReference
    | FunctionCall
    | BinaryOpExpression
    | ScopedExpression
    | LogicalNot
    | FieldExpression

export type FieldExpression =
    | {
          kind: 'FIELD_FROM_STRING'
          value: Expression & { type: { universe: 'string' } }
          type: FieldSet
      }
    | {
          kind: 'FIELD_NOT'
          operand: Expression & { type: FieldSet }
          type: FieldSet
      }
    | {
          kind: 'FIELD_LENGTH'
          operand: Expression & { type: FieldSet }
          type: ValueSet & { universe: 'integer' }
      }
    | {
          kind:
              | 'FIELD_AND'
              | 'FIELD_OR'
              | 'FIELD_XOR'
              | 'FIELD_ADJUST'
              | 'FIELD_ROTATE_STATES'
              | 'FIELD_MODULATE'
          left: Expression & { type: FieldSet }
          right: Expression & { type: FieldSet }
          type: FieldSet
      }
    | {
          kind: 'FIELD_SHIFT_LEFT' | 'FIELD_SHIFT_RIGHT'
          left: Expression & { type: FieldSet }
          right: Expression & { type: { universe: 'integer' } }
          type: FieldSet
      }

type LogicalNot = {
    kind: 'NOT'
    operand: Expression
    type: ValueSet & { universe: 'truthvalue' }
}

type ScopedExpression = {
    kind: 'SCOPE'
    statements: Statement[]
    value: Expression
    cleanup: Extract<Statement, { kind: 'RELEASE' }>[]
    type: ValueSet
}

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
