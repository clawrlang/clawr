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
    parameters: {
        label?: string
        varName: string
        valueSet: ValueSet
    }[]
    resultValueSet?: ValueSet
}

type TypeDeclaration = {
    kind: 'TYPE_DECL'
    name: string
    base?: { type: string; namespace?: string }
    fields: {
        name: string
        valueSet: ValueSet
    }[]
    methods: FunctionDeclaration[]
    dispatchTable?: {
        slot: FunctionSignature
        declaredIn: { name: string; namespace?: string }
        implementedBy?: { name: string; namespace?: string }
    }[]
}

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
    dispatch: 'direct' | 'inherited'
}

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
    valueSet: StringValueSet
}

type IntegerLiteral = {
    kind: 'INTEGER_LITERAL'
    value: string
    valueSet: IntegerValueSet
}

type TruthLiteral = {
    kind: 'TRUTHVALUE_LITERAL'
    value: 'false' | 'ambiguous' | 'true'
    valueSet: TruthValueSet
}

type MemoryAllocation = {
    kind: 'ALLOCATION'
    valueSet: RcTypeValueSet
    fields: {
        name: string
        value: Expression
    }[]
}

type MemoryRetention = {
    kind: 'RETAIN'
    object: Storage
    valueSet: RcTypeValueSet
}

type AsShared = {
    kind: 'AS_SHARED'
    object: QueryFunctionCall
    valueSet: RcTypeValueSet
}

type VariableReference = {
    kind: 'VARIABLE_REF'
    name: string
    valueSet: ValueSet
}

type FieldReference = {
    kind: 'FIELD_REF'
    object: Expression
    field: string
    valueSet: ValueSet
}

type QueryFunctionCall = FunctionCall & { valueSet: ValueSet }

export type Expression =
    | StringLiteral
    | IntegerLiteral
    | TruthLiteral
    | MemoryAllocation
    | MemoryRetention
    | AsShared
    | VariableReference
    | FieldReference
    | QueryFunctionCall

// ----------
// Value Sets
// ----------

type IntegerValueSet = {
    type: 'integer'
    min?: string
    max?: string
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
    semantics: 'SHARED' | 'ISOLATED'
}

export type ValueSet =
    | IntegerValueSet
    | RealValueSet
    | TruthValueSet
    | StringValueSet
    | RcTypeValueSet
