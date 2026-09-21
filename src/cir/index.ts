import { decimal } from 'decimalish'
import { tags } from 'typia'

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
    methods: FunctionSignature[]
}

type VariableDeclaration = {
    kind: 'VARIABLE_DECL'
    name: string
    lattice: ValueSet
    initialValue: Expression
}

type FunctionDeclaration = {
    kind: 'FUNCTION_DECL'
    body: Statement[]
} & FunctionSignature

type FunctionSignature = {
    baseName: string
    labels: string[]
    parameters: {
        name: string
        lattice: ValueSet
    }[]
    lattice?: ValueSet
}

type RCTypeDeclaration = {
    // `data` only supports these
    kind: 'RC_TYPE_DECL'
    name: string
    fields: {
        name: string
        lattice: ValueSet
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
          initializers: (FunctionDeclaration & { lattice?: undefined })[]
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

export type Declaration = { namespace?: string } & (
    | VariableDeclaration
    | FunctionDeclaration
    | RCTypeDeclaration
    | InterfaceDeclaration
)

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
          object: Expression & { value: RCTypeSet | InterfaceSet }
          dispatch: 'direct'
      }
    | {
          object: Expression & { value: RCTypeSet }
          dispatch: 'inherited'
      }
    | {
          object: Expression & { value: InterfaceDeclaration }
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
    value: Omit<MemoryAllocation, 'kind' | 'isolationLevel'> & { kind: 'DATA' }
}

export type Statement =
    | EnsureUnique
    | Release
    | FunctionCall
    | Return
    | VariableDeclaration
    | Assign
    | SelfAssign

type Storage = Omit<VariableReference, 'value'> | Omit<FieldReference, 'value'>

// -----------
// Expressions
// -----------

type StringLiteral = {
    kind: 'STRING_LITERAL'
    value: StringSet & { value: string }
}

type IntegerLiteral<Value extends bigint> = {
    kind: 'INTEGER_LITERAL'
    value: IntegerRange<Value, Value>
}

type TruthvalueLiteral<Value extends truthvalue> = {
    kind: 'TRUTHVALUE_LITERAL'
    value: TruthvalueSet<[Value]>
}

type MemoryAllocation = {
    kind: 'ALLOCATION'
    isolationLevel: IsolationLevel
    fields?: {
        name: string
        value: Expression
    }[]
    value: RCTypeSet
}

type MemoryRetention = {
    kind: 'RETAIN'
    object: Storage
    value: RCTypeSet
}

type AsShared = {
    kind: 'AS_SHARED'
    object: FunctionCall & Expression
    value: RCTypeSet
}

type Box = {
    kind: 'BOX'
    expression: Expression
    value: ValueSet & { boxed: true }
}

type VariableReference = {
    kind: 'VARIABLE_REF'
    name: string
    value: ValueSet
}

type FieldReference = {
    kind: 'FIELD_REF'
    object: Expression
    field: string
    value: ValueSet
}

export type Expression =
    | StringLiteral
    | IntegerLiteral<bigint>
    | TruthvalueLiteral<truthvalue>
    | MemoryAllocation
    | MemoryRetention
    | AsShared
    | Box
    | VariableReference
    | FieldReference
    | (FunctionCall & { value: ValueSet })

// --------
// Lattices
// --------

type IntegerRange<
    Min extends bigint | undefined = bigint | undefined,
    Max extends bigint | undefined = bigint | undefined,
> = {
    type: 'integer'
    boxed?: true
} & (Min extends undefined
    ? { min?: undefined }
    : { min: `${Min}` & tags.Pattern<'^-?\\d+$'> }) &
    (Max extends undefined
        ? { max?: undefined }
        : { max: `${Max}` & tags.Pattern<'^-?\\d+$'> })

type RealRange<
    Min extends decimal | undefined = decimal | undefined,
    Max extends decimal | undefined = decimal | undefined,
> = {
    type: 'real'
    boxed?: true
} & (Min extends undefined
    ? { min?: undefined }
    : { min: `${Min}` & tags.Pattern<'^-?\\d+\.\\d+$'> }) &
    (Max extends undefined
        ? { max?: undefined }
        : { max: `${Max}` & tags.Pattern<'^-?\\d+\.\\d+$'> })

type TruthvalueSet<Values extends truthvalue[] = truthvalue[]> = {
    type: 'truthvalue'
    boxed?: true
    values: Values
}

type StringSet = { type: 'string'; value?: string }

type RCTypeSet = {
    type: 'rc-type'
    namespace?: string
    name: string
}

type InterfaceSet = {
    type: 'interface'
    namespace?: string
    name: string
}

export type ValueSet =
    | IntegerRange
    | RealRange
    | TruthvalueSet
    | StringSet
    | RCTypeSet
    | InterfaceSet

type IsolationLevel = 'ISOLATED' | 'SHARED'
type truthvalue = 'false' | 'ambiguous' | 'true'
