export type ClawrModule = {
    $schema: 'http://clawr.lang/schema/cir/DRAFT-0'
    startBlock?: Statement[]
    declarations?: Declaration[]
}

export type Declaration = VariableDeclaration | DataDeclaration

type VariableDeclaration = {
    kind: 'VARIABLE_DECL'
    name: string
    type: string
    initialValue: Expression
}

type DataDeclaration = {
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

type EnsureUnique = {
    kind: 'ENSURE_UNIQUE'
    object: Expression
}

type CallFunc = {
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

type Release = {
    kind: 'RELEASE'
    object: VariableReference | FieldReference
}

type Assignment = {
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

type StringLiteral = {
    kind: 'STRING_LITERAL'
    value: string
}

type IntegerLiteral = {
    kind: 'INTEGER_LITERAL'
    value: string
}

type TruthValueLiteral = {
    kind: 'TRUTHVALUE_LITERAL'
    value: 'false' | 'ambiguous' | 'true'
}

type Allocation = {
    kind: 'ALLOCATE'
    type: string
    semantics: 'REF' | 'COW'
    fields: {
        name: string
        value: Expression
    }[]
}

type Retain = {
    kind: 'RETAIN'
    object: VariableReference | FieldReference
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
