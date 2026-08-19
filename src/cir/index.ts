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
    valueSet: ValueSet
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
        valueSet: ValueSet
    }[]
    resultValueSet?: ValueSet
}

type TypeDeclaration = {
    // `data` only supports these
    kind: 'TYPE_DECL'
    name: string
    fields: {
        name: string
        valueSet: ValueSet
    }[]
} & ( // `object`/`service` add methods and optional inheritance
    | {
          base?: CanonicalName
          methods: FunctionDeclaration[]
          initializers?: Omit<FunctionDeclaration, 'resultValueSet'>[]
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
    VariableDeclaration | FunctionDeclaration | TypeDeclaration
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
    value: string
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

// ----------
// Value Sets
// ----------

type IntegerValueSet = {
    type: 'integer'
    min?: `${bigint}` & tags.Pattern<'^-?\\d+$'>
    max?: `${bigint}` & tags.Pattern<'^-?\\d+$'>
}

type RealValueSet = {
    type: 'real'
    min?: string // numeric, can be arbitrarity big
    max?: string // numeric, can be arbitrarity big
}

type TruthValueSet = {
    type: 'truthvalue'
    values: ('false' | 'ambiguous' | 'true')[]
}

type StringValueSet = { type: 'string' }

type RcTypeValueSet = {
    type: 'rc-type'
    namespace?: string
    typeName: string
}

export type ValueSet =
    | IntegerValueSet
    | RealValueSet
    | TruthValueSet
    | StringValueSet
    | RcTypeValueSet

type IsolationLevel = 'ISOLATED' | 'SHARED'
