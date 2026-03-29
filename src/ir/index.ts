// IR for emitting C code (semantic, not C-like)

// ---- Expressions ----
export type CExpression = CVariableReference | CStringLiteral | CFunctionCall

export interface CStringLiteral {
    kind: 'string'
    value: string
}

export interface CVariableReference {
    kind: 'var-ref'
    name: string
}

// ---- Statements ----
export type CStatement = CVariableDeclaration | CFunctionCall | CAssignment

export interface CVariableDeclaration {
    kind: 'var-decl'
    type: string
    name: string
    value: CExpression
}

export interface CFunctionCall {
    kind: 'function-call'
    name: string
    arguments: CExpression[]
}

export interface CAssignment {
    kind: 'assign'
    target: CExpression // e.g., field access or variable
    value: CExpression
}

// ---- Function Declarations ----
export interface CFunctionDeclaration {
    kind: 'function'
    name: string
    returnType: string
    parameters: { name: string; type: string }[]
    body: CStatement[]
}

// ---- Struct Types ----
export interface CStruct {
    kind: 'struct'
    name: string
    fields: { name: string; type: string }[]
}

// ---- Module ----
export interface CModule {
    structs: CStruct[]
    variables: CVariableDeclaration[]
    functions: CFunctionDeclaration[]
}
