import { decimal } from 'decimalish'

export type ClawrModule = {
    $schema: 'http://clawr.lang/schema/cir/DRAFT-0'
    startBlock?: Statement[]
    declarations?: Declaration[]
}

// ------------
// Declarations
// ------------

type InterfaceDeclaration = {
    kind: 'INTERFACE_DECL'
    name: string
    namespace?: string
    methods: FunctionSignature[]
}

type VariableDeclaration = {
    kind: 'VARIABLE_DECL'
    name: string
    namespace?: string
    type: ValueSet
    initialValue: Expression
}

type FunctionDeclaration = {
    kind: 'FUNCTION_DECL'
    body: Statement[]
} & FunctionSignature & { namespace?: string }

type FunctionSignature = {
    baseName: string
    labels: string[]
    parameters: {
        name: string
        type: ValueSet
    }[]
    type: ValueSet | { universe: 'void' }
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
} & ( // `object`/`service` add methods and initializers
    | {
          base?: CanonicalName
          methods: FunctionDeclaration[]
          initializers: (FunctionDeclaration & {
              type: { universe: 'void' }
          })[]
          dispatchTable?: {
              slot: FunctionSignature
              declaredIn: CanonicalName
              implementation?: CanonicalName
          }[]
      }
    | {}
)

export type CanonicalName = { name: string; namespace?: string }

type FunctionName = {
    baseName: string
    labels: string[]
}

export type Declaration =
    | VariableDeclaration
    | FunctionDeclaration
    | RCTypeDeclaration
    | InterfaceDeclaration

// ----------
// Statements
// ----------

type EnsureUnique = {
    kind: 'ENSURE_UNIQUE'
    object: Storage
}

type Release = {
    kind: 'RELEASE'
    object: Storage
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
          object: Expression & { type: InterfaceDeclaration }
          dispatch: 'conformance'
      }

type FunctionCall = {
    kind: 'CALL'
    receiver?: Receiver
    name: FunctionName & { namespace?: string }
    arguments: Expression[]
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

type SelfAssign = {
    kind: 'SELF_ASSIGN'
    value: Omit<Allocation, 'kind' | 'isolationLevel'> & { kind: 'DATA' }
}

export type Statement =
    | EnsureUnique
    | Release
    | FunctionCall
    | Return
    | VariableDeclaration
    | Assign
    | SelfAssign

type Storage = Omit<VariableReference, 'type'> | Omit<PropertyReference, 'type'>

// -----------
// Expressions
// -----------

type StringLiteral = {
    kind: 'STRING_LITERAL'
    type: StringSingleton
}

type IntegerLiteral<Value extends bigint = bigint> = {
    kind: 'INTEGER_LITERAL'
    type: IntegerSingleton<Value>
}

type RealLiteral<Value extends decimal = decimal> = {
    kind: 'REAL_LITERAL'
    type: RealSingleton<Value>
}

type TruthvalueLiteral<Value extends truthvalue = truthvalue> = {
    kind: 'TRUTHVALUE_LITERAL'
    type: TruthvalueSingleton<Value>
}

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
    type: RCTypeSet
}

type AsShared = {
    kind: 'AS_SHARED'
    object: FunctionCall & Expression
    type: RCTypeSet
}

type Box = {
    kind: 'BOX'
    expression: Expression
    type: ValueSet & { boxed: true }
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
    type: TruthvalueSet<['false', 'true']>
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
    type: TruthvalueSet<['false', 'true']>
}

type RefComparison = {
    kind: 'SAME' | 'NOT_SAME'
    left: Expression & { type: { universe: 'rc-type' | 'interface' } }
    right: Expression & { type: { universe: 'rc-type' | 'interface' } }
    type: TruthvalueSet<['false', 'true']>
}

type LogicalOperation = {
    kind: 'AND' | 'OR'
    left: Expression & { type: { universe: 'truthvalue' } }
    right: Expression & { type: { universe: 'truthvalue' } }
    type: TruthvalueSet<['false', 'true']>
}

export type Expression =
    | StringLiteral
    | IntegerLiteral
    | RealLiteral
    | TruthvalueLiteral
    | Allocation
    | Retain
    | AsShared
    | Box
    | VariableReference
    | PropertyReference
    | (FunctionCall & { type: ValueSet })
    | ArithmeticOperation
    | EqualityComparison
    | OrderComparison
    | RefComparison
    | LogicalOperation

// ---------
// ValueSets
// ---------

type IntegerSet = IntegerRange | IntegerSingleton

type IntegerRange<
    Min extends bigint | undefined = bigint | undefined,
    Max extends bigint | undefined = bigint | undefined,
> = {
    universe: 'integer'
    boxed?: true
} & ((Min extends undefined ? { min?: undefined } : { min: `${Min}` }) &
    (Max extends undefined ? { max?: undefined } : { max: `${Max}` }))

type IntegerSingleton<Value extends bigint = bigint> = {
    universe: 'integer'
    boxed?: true
    value: `${Value}`
}

type RealSet = RealRange | RealSingleton

type RealRange<
    Min extends decimal | undefined = decimal | undefined,
    Max extends decimal | undefined = decimal | undefined,
> = {
    universe: 'real'
    boxed?: true
} & (Min extends undefined ? { min?: undefined } : { min: `${Min}` }) &
    (Max extends undefined ? { max?: undefined } : { max: `${Max}` })

type RealSingleton<Value extends decimal = decimal> = {
    universe: 'real'
    boxed?: true
    value: `${Value}`
}

type TruthvalueSet<Values extends truthvalue[] = truthvalue[]> =
    | {
          universe: 'truthvalue'
          boxed?: true
          values: Values
      }
    | TruthvalueSingleton<Values[number]>

type TruthvalueSingleton<Value extends truthvalue = truthvalue> = {
    universe: 'truthvalue'
    boxed?: true
    value: Value
}

type StringSet = UnlimitedString | StringSingleton
type UnlimitedString = { universe: 'string' }
type StringSingleton = { universe: 'string'; value: string }

type RCTypeSet = {
    universe: 'rc-type'
    namespace?: string
    name: string
}

type InterfaceSet = {
    universe: 'interface'
    namespace?: string
    name: string
}

export type ValueSet =
    IntegerSet | RealSet | TruthvalueSet | StringSet | RCTypeSet | InterfaceSet

type IsolationLevel = 'ISOLATED' | 'SHARED'
export type truthvalue = 'false' | 'ambiguous' | 'true'
