export type ClawrModule = {
    $schema: 'http://clawr.lang/schema/cir/DRAFT-0'
    startBlock?: Statement[]
    declarations?: Declaration[]
}

type VariableDeclaration = {
    kind: 'VARIABLE_DECL'
    name: string
    valueSet: ValueSet
    initialValue: Expression
}

type FunctionDeclaration = {
    kind: 'FUNCTION_DECL'
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
    name: string
    fields: {
        name: string
        valueSet: ValueSet
    }[]
    methods?: FunctionDeclaration[]
    companionMethods?: FunctionDeclaration[]
}

export type Declaration =
    VariableDeclaration | FunctionDeclaration | TypeDeclaration

type EnsureUnique = {
    kind: 'ENSURE_UNIQUE'
    object: Storage
}

type Release = {
    kind: 'RELEASE'
    object: Storage
}

type Exec = {
    kind: 'EXEC'
    name: {
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
    EnsureUnique | Release | Exec | Return | VariableDeclaration | Assign

type Storage = VariableReference | FieldReference

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
    kind: 'ALLOCATE'
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
    targetSemantics: 'SHARED' | 'ISOLATED'
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

type QueryFunctionCall = {
    kind: 'QUERY'
    name: {
        baseName: string
        labels: string[]
    }
    arguments: Expression[]
    valueSet: ValueSet
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
    | QueryFunctionCall

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
    typeName: string
    semantics: 'SHARED' | 'ISOLATED'
}

export type ValueSet =
    | IntegerValueSet
    | RealValueSet
    | TruthValueSet
    | StringValueSet
    | RcTypeValueSet
