export interface ClawrModule {
    $schema: 'http://clawr.lang/schema/cir/DRAFT-0'
    startBlock?: Statement[]
    declarations?: Declaration[]
}

export type Declaration = VariableDeclaration | DataDeclaration

export interface VariableDeclaration {
    kind: 'VARIABLE_DECL'
    name: string
    type: string
    initialValue: Expression
}

export interface DataDeclaration {
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

export interface EnsureUnique {
    kind: 'ENSURE_UNIQUE'
    object: Expression
}

export interface CallFunc {
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

export interface Release {
    kind: 'RELEASE'
    object: VariableReference | FieldReference
}

export interface Assignment {
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

export interface StringLiteral {
    kind: 'STRING_LITERAL'
    value: string
}

export interface IntegerLiteral {
    kind: 'INTEGER_LITERAL'
    value: string
}

export interface TruthValueLiteral {
    kind: 'TRUTHVALUE_LITERAL'
    value: 'false' | 'ambiguous' | 'true'
}

export interface Allocation {
    kind: 'ALLOCATE'
    type: string
    semantics: 'REF' | 'COW'
    fields: {
        name: string
        value: Expression
    }[]
}

export interface Retain {
    kind: 'RETAIN'
    object: VariableReference | FieldReference
}

export interface VariableReference {
    kind: 'VARIABLE_REF'
    name: string
}

export interface FieldReference {
    kind: 'FIELD_REF'
    object: Expression
    field: string
}
