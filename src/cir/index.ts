export type ClawrModule = {
    $schema: 'http://clawr.lang/schema/cir/DRAFT-0'
    startBlock?: Statement[]
    declarations?: Declaration[]
}

export type Declaration = VariableDeclaration | DataDeclaration

export type VariableDeclaration = {
    kind: 'VARIABLE_DECL'
    name: string
    type: string
    initialValue: Expression
}

export type DataDeclaration = {
    kind: 'DATA_DECL'
    name: string
    fields: {
        name: string
        type: string
    }[]
}

export type Statement =
    | EnsureUnique
    | Release
    | CallFunc
    | VariableDeclaration
    | Assignment

export type EnsureUnique = {
    kind: 'ENSURE_UNIQUE'
    object: Expression
}

export type CallFunc = {
    kind: 'CALL_FUNC'
    signature: {
        baseName: string
        parameters: {
            label?: string
            type: string
        }[]
    }
    arguments: Expression[]
}

export type Release = {
    kind: 'RELEASE'
    object: VariableReference | FieldReference
}

export type Assignment = {
    kind: 'ASSIGN'
    target: VariableReference | FieldReference
    value: Expression
}

export type Expression =
    | StringLiteral
    | IntegerLiteral
    | TruthValueLiteral
    | Allocation
    | Retain
    | VariableReference
    | FieldReference
    | CallFunc

export type StringLiteral = {
    kind: 'STRING_LITERAL'
    value: string
}

export type IntegerLiteral = {
    kind: 'INTEGER_LITERAL'
    value: string
}

export type TruthValueLiteral = {
    kind: 'TRUTHVALUE_LITERAL'
    value: 'false' | 'ambiguous' | 'true'
}

export type Allocation = {
    kind: 'ALLOCATE'
    type: string
    semantics: 'REF' | 'COW'
    fields: {
        name: string
        value: Expression
    }[]
}

export type Retain = {
    kind: 'RETAIN'
    object: VariableReference | FieldReference
}

export type VariableReference = {
    kind: 'VARIABLE_REF'
    name: string
}

export type FieldReference = {
    kind: 'FIELD_REF'
    object: Expression
    field: string
}
