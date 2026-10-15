import { Expression } from './expression.js'
import { BooleanSet, IntegerSet, RealRange } from './value-set.js'

export type BinaryOpExpression =
    | ArithmeticOperation
    | EqualityComparison
    | OrderComparison
    | RefComparison
    | LogicalOperation

type ArithmeticOperation = {
    kind:
        | 'ADDITION'
        | 'SUBTRACTION'
        | 'MULTIPLICATION'
        | 'DIVISION'
        | 'MODULUS'
        | 'EXPONENTIAL'
} & (
    | {
          left: Expression & { type: { universe: 'integer' } }
          right: Expression & { type: { universe: 'integer' } }
          type: IntegerSet
      }
    | {
          left: Expression & { type: { universe: 'integer' | 'real' } }
          right: Expression & { type: { universe: 'integer' | 'real' } }
          type: RealRange
      }
)

type EqualityComparison = {
    kind: 'EQUAL' | 'NOT_EQUAL'
    type: BooleanSet
} & (
    | {
          left: Expression & { type: { universe: 'integer' } }
          right: Expression & { type: { universe: 'integer' } }
      }
    | {
          left: Expression & { type: { universe: 'real' } }
          right: Expression & { type: { universe: 'real' } }
      }
    | {
          left: Expression & { type: { universe: 'truthvalue' } }
          right: Expression & { type: { universe: 'truthvalue' } }
      }
)

type OrderComparison = {
    kind:
        | 'LESS_THAN'
        | 'GREATER_THAN'
        | 'LESS_THAN_OR_EQUAL'
        | 'GREATER_THAN_OR_EQUAL'
    left: Expression & { type: { universe: 'integer' | 'real' } }
    right: Expression & { type: { universe: 'integer' | 'real' } }
    type: BooleanSet
}

type RefComparison = {
    kind: 'SAME' | 'NOT_SAME'
    left: Expression & { type: { universe: 'rc-type' | 'interface' } }
    right: Expression & { type: { universe: 'rc-type' | 'interface' } }
    type: BooleanSet
}

type LogicalOperation = {
    kind: 'AND' | 'OR'
    left: Expression & { type: { universe: 'truthvalue' } }
    right: Expression & { type: { universe: 'truthvalue' } }
    type: BooleanSet
}
