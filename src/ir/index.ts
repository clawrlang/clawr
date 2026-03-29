// IR for emitting C code

// ---- Expressions ----

export type CExpression = CVariableReference | CStringLiteral | CFunctionCall

export interface CStringLiteral {
    kind: 'string'
    value: string
}

type CVariableReference = {
    kind: 'var-ref'
    name: string
}

// ---- Statements ----

export type CStatement = CVariableDeclaration | CFunctionCall

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

export interface CModule {
    body: CStatement[]
}
