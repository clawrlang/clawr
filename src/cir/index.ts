import { tags } from 'typia'

export type ClawrModule = {
    $schema: 'http://clawr.lang/schema/cir/DRAFT-0'
    startBlock?: Statement[]
    declarations?: Declaration[]
}

// ------------
// Declarations
// ------------

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
} & ( // `object`/`service` add methods and optional inheritance
    | {
          base?: CanonicalName
          methods: FunctionDeclaration[]
          initializers?: (FunctionDeclaration & { lattice?: undefined })[]
          dispatchTable?: {
              slot: FunctionSignature
              declaredIn: CanonicalName
              implementedBy?: CanonicalName
          }[]
      }
    | {}
)

export type CanonicalName = { name: string; namespace?: string }

export type Declaration = { namespace?: string } & (
    VariableDeclaration | FunctionDeclaration | RCTypeDeclaration
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

type Receiver = {
    object: Storage
} & (
    | {
          dispatch: 'direct'
          type: CanonicalName
      }
    | {
          dispatch: 'inherited'
          declaredIn: CanonicalName
      }
)

type FunctionCall = {
    kind: 'CALL'
    receiver?: Receiver
    name: {
        namespace?: string
        baseName: string
        labels: string[]
    }
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
    type: CanonicalName
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

type TruthvalueLattice<T extends truthvalue[]> = {
    type: 'truthvalue'
    values: T
}

type StringLattice = { type: 'string'; value?: string }

type RCTypeLattice = {
    type: 'rc-type'
    namespace?: string
    name: string
}

export type Lattice =
    | IntegerLattice<bigint | undefined, bigint | undefined>
    | RealLattice
    | TruthvalueLattice<truthvalue[]>
    | StringLattice
    | RCTypeLattice

type IsolationLevel = 'ISOLATED' | 'SHARED'
type truthvalue = 'false' | 'ambiguous' | 'true'
