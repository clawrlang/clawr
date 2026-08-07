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
    namespace?: string
    name: string
    valueSet: ValueSet
    initialValue: Expression
}

type FunctionDeclaration = {
    kind: 'FUNCTION_DECL'
    namespace?: string
    baseName: string
    parameters: {
        label?: string
        varName: string
        valueSet: ValueSet
    }[]
    body: Statement[]
    resultValueSet?: ValueSet
}

type TypeDeclaration = {
    kind: 'TYPE_DECL'
    namespace?: string
    name: string
    fields: {
        name: string
        valueSet: ValueSet
    }[]
    methods: FunctionDeclaration[]
}

export type Declaration =
    VariableDeclaration | FunctionDeclaration | TypeDeclaration

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

type FunctionCall = {
    kind: 'CALL'
    receiver?: Expression
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
