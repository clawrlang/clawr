// IR for emitting C code (semantic, not C-like)

// ---- Expressions ----
export type CExpression =
    | CVariableReference
    | CStringLiteral
    | CFunctionCall
    | CStructInitializer
    | CFieldReference
    | CRawExpression

export interface CStringLiteral {
    kind: 'string'
    value: string
}

export interface CVariableReference {
    kind: 'var-ref'
    name: string
}

export interface CCallDispatch {
    kind: 'direct' | 'virtual'
    methodName?: string
    ownerType?: string
    receiverType?: string
}

export interface CRawExpression {
    kind: 'raw-expression'
    expression: string
}

export interface CStructInitializer {
    kind: 'struct-init'
    fields: { [field: string]: CExpression }
}

export interface CFieldReference {
    kind: 'field-reference'
    object: CExpression
    field: string
    deref: boolean // true for ->, false for .
}

// ---- Statements ----
export type CStatement =
    | CVariableDeclaration
    | CFunctionCall
    | CAssignment
    | CIfStatement
    | CWhileStatement
    | CBreakStatement
    | CContinueStatement
    | CReturnStatement

export interface CVariableDeclaration {
    kind: 'var-decl'
    type: string
    name: string
    value: CExpression
    modifiers?: string[]
}

export interface CFunctionCall {
    kind: 'function-call'
    name: string
    arguments: CExpression[]
    dispatch?: CCallDispatch
    receiver?: CExpression // For virtual dispatch calls, the receiver object
}

export interface CAssignment {
    kind: 'assign'
    target: CExpression // e.g., field access or variable
    value: CExpression
}

export interface CIfStatement {
    kind: 'if'
    condition: CExpression
    thenBranch: CStatement[]
    elseBranch?: CStatement[]
}

export interface CWhileStatement {
    kind: 'while'
    condition: CExpression
    body: CStatement[]
}

export interface CBreakStatement {
    kind: 'break'
}

export interface CContinueStatement {
    kind: 'continue'
}

export interface CFunctionDeclaration {
    kind: 'function'
    name: string
    returnType: string
    parameters: { name: string; type: string }[]
    body: CStatement[]
}

export interface CReturnStatement {
    kind: 'return'
    value: CExpression
}

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
