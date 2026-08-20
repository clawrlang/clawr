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

type Storage = VariableReference | FieldReference

// -----------
// Expressions
// -----------

type StringLiteral = {
    kind: 'STRING_LITERAL'
    value: string
}

type IntegerLiteral = {
    kind: 'INTEGER_LITERAL'
    value: `${bigint}` & tags.Pattern<'^-?\\d+$'>
}

type TruthLiteral = {
    kind: 'TRUTHVALUE_LITERAL'
    value: 'false' | 'ambiguous' | 'true'
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
}

type MemoryRetention = {
    kind: 'RETAIN'
    object: Storage
}

type AsShared = {
    kind: 'AS_SHARED'
    object: FunctionCall
}

type VariableReference = {
    kind: 'VARIABLE_REF'
    name: string
}

type FieldReference = {
    kind: 'FIELD_REF'
    object: Expression
    field: string
}

export type Expression =
    | StringLiteral
    | IntegerLiteral
    | TruthLiteral
    | MemoryAllocation
    | MemoryRetention
    | AsShared
    | VariableReference
    | FieldReference
    | FunctionCall

// --------
// Lattices
// --------

type IntegerLattice = {
    type: 'integer'
    min?: `${bigint}` & tags.Pattern<'^-?\\d+$'>
    max?: `${bigint}` & tags.Pattern<'^-?\\d+$'>
}

type RealLattice = {
    type: 'real'
    min?: string // numeric, can be arbitrarity big
    max?: string // numeric, can be arbitrarity big
}

type TruthvalueLattice = {
    type: 'truthvalue'
    values: ('false' | 'ambiguous' | 'true')[]
}

type StringLattice = { type: 'string' }

type RCTypeLattice = {
    type: 'rc-type'
    namespace?: string
    name: string
}

export type Lattice =
    | IntegerLattice
    | RealLattice
    | TruthvalueLattice
    | StringLattice
    | RCTypeLattice

type IsolationLevel = 'ISOLATED' | 'SHARED'
