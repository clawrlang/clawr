import { tags } from 'typia'

export type ClawrModule = {
    $schema: 'http://clawr.lang/schema/cir/DRAFT-0'
    startBlock?: Statement[]
    declarations?: Declaration[]
}

// ------------
// Declarations
// ------------

type ProtocolDeclaration = {
    kind: 'PROTOCOL_DECL'
    name: string
    requirements: FunctionSignature[]
}

type VariableDeclaration = {
    kind: 'VARIABLE_DECL'
    name: string
    lattice: Lattice
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
        lattice: Lattice
    }[]
    lattice?: Lattice
}

type RCTypeDeclaration = {
    // `data` only supports these
    kind: 'RC_TYPE_DECL'
    name: string
    fields: {
        name: string
        lattice: Lattice
    }[]
    conformances?: {
        protocol: CanonicalName
        fulfillments: {
            requirement: FunctionName
            implementation: FunctionName
        }[]
    }[]
} & ( // `object`/`service` add methods and optional inheritance
    | {
          base?: CanonicalName
          methods: FunctionDeclaration[]
          initializers?: (FunctionDeclaration & { lattice?: undefined })[]
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
    | ProtocolDeclaration
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
          object: Expression & { value: RCTypeLattice | ProtocolLattice }
          dispatch: 'direct'
      }
    | {
          object: Expression & { value: RCTypeLattice }
          dispatch: 'inherited'
      }
    | {
          object: Expression & { value: ProtocolDeclaration }
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

export type Statement =
    | EnsureUnique
    | Release
    | FunctionCall
    | Return
    | VariableDeclaration
    | Assign

type Storage = Omit<VariableReference, 'value'> | Omit<FieldReference, 'value'>

// -----------
// Expressions
// -----------

type StringLiteral = {
    kind: 'STRING_LITERAL'
    value: StringLattice & { value: string }
}

type IntegerLiteral<Value extends bigint> = {
    kind: 'INTEGER_LITERAL'
    value: IntegerLattice<Value, Value>
}

type TruthLiteral<Value extends truthvalue> = {
    kind: 'TRUTHVALUE_LITERAL'
    value: TruthvalueLattice<[Value]>
}

type MemoryAllocation = {
    kind: 'ALLOCATION'
    base?: CanonicalName
    isolationLevel: IsolationLevel
    fields: {
        name: string
        value: Expression
    }[]
    value: RCTypeLattice
}

type MemoryRetention = {
    kind: 'RETAIN'
    object: Storage
    value: RCTypeLattice
}

type AsShared = {
    kind: 'AS_SHARED'
    object: FunctionCall & Expression
    value: RCTypeLattice
}

type Box = {
    kind: 'BOX'
    expression: Expression
    value: Lattice & { boxed: true }
}

type VariableReference = {
    kind: 'VARIABLE_REF'
    name: string
    value: Lattice
}

type FieldReference = {
    kind: 'FIELD_REF'
    object: Expression
    field: string
    value: Lattice
}

export type Expression =
    | StringLiteral
    | IntegerLiteral<bigint>
    | TruthLiteral<truthvalue>
    | MemoryAllocation
    | MemoryRetention
    | AsShared
    | Box
    | VariableReference
    | FieldReference
    | (FunctionCall & { value: Lattice })

// --------
// Lattices
// --------

type IntegerLattice<
    Min extends bigint | undefined,
    Max extends bigint | undefined,
> = {
    type: 'integer'
    boxed?: true
} & (Min extends undefined
    ? { min?: undefined }
    : { min: `${Min}` & tags.Pattern<'^-?\\d+$'> }) &
    (Max extends undefined
        ? { max?: undefined }
        : { max: `${Max}` & tags.Pattern<'^-?\\d+$'> })

type RealLattice = {
    type: 'real'
    min?: string // numeric, can be arbitrarity big
    max?: string // numeric, can be arbitrarity big
}

type TruthvalueLattice<Values extends truthvalue[]> = {
    type: 'truthvalue'
    boxed?: true
    values: Values
}

type StringLattice = { type: 'string'; value?: string }

type RCTypeLattice = {
    type: 'rc-type'
    namespace?: string
    name: string
}

type ProtocolLattice = {
    type: 'protocol'
    namespace?: string
    name: string
}

export type Lattice =
    | IntegerLattice<bigint | undefined, bigint | undefined>
    | RealLattice
    | TruthvalueLattice<truthvalue[]>
    | StringLattice
    | RCTypeLattice
    | ProtocolLattice

type IsolationLevel = 'ISOLATED' | 'SHARED'
type truthvalue = 'false' | 'ambiguous' | 'true'
