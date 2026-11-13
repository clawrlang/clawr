import { Expression } from './expression.js'
import { BoxedValueSet, InterfaceSet, RCTypeSet, ValueSet } from './value-set.js'

export type MemoryExpression = Allocation | Retain | AsShared | Box

type Allocation = {
    kind: 'ALLOCATION'
    isolationLevel: IsolationLevel
    properties?: {
        name: string
        value: Expression
    }[]
    type: RCTypeSet
}

type Retain = {
    kind: 'RETAIN'
    object: Storage
    type: RCTypeSet | InterfaceSet | BoxedValueSet
}

type AsShared = {
    kind: 'AS_SHARED'
    object: Extract<Expression, { kind: 'CALL' }>
    type: RCTypeSet | InterfaceSet
}

type Box = {
    kind: 'BOX'
    expression: Expression
    type: ValueSet & { boxed: true }
}

export type Storage = VariableReference | PropertyReference
export type IsolationLevel = 'ISOLATED' | 'SHARED'

export type VariableReference = {
    kind: 'VARIABLE_REF'
    name: string
}

export type PropertyReference = {
    kind: 'PROPERTY_REF'
    object: Expression
    property: string
}
