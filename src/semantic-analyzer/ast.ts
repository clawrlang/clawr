import type {
    ASTDataDeclaration,
    ASTDataLiteral,
    ASTIdentifier,
    ASTIntegerLiteral,
    ASTPosition,
    ASTTruthValueLiteral,
} from '../ast'

export interface SemanticFieldAccess {
    kind: 'field-access'
    object: SemanticExpression
    field: string
    position: ASTPosition
}

export type SemanticExpression =
    | ASTIntegerLiteral
    | ASTTruthValueLiteral
    | ASTIdentifier
    | ASTDataLiteral
    | SemanticFieldAccess

export interface SemanticValueSet {
    type: string
}

export interface SemanticVariableDeclaration {
    kind: 'var-decl'
    semantics: 'const' | 'mut' | 'ref'
    name: string
    valueSet: SemanticValueSet
    value: SemanticExpression
    position?: ASTPosition
}

export interface SemanticPrintStatement {
    kind: 'print'
    value: SemanticExpression
    dispatchType: string
    position: ASTPosition
}

export interface SemanticAssignment {
    kind: 'assign'
    target: SemanticExpression
    value: SemanticExpression
    position: ASTPosition
}

export type SemanticStatement =
    | SemanticVariableDeclaration
    | SemanticPrintStatement
    | SemanticAssignment

export type SemanticDataDeclaration = ASTDataDeclaration

export interface SemanticFunction {
    kind: 'function'
    name: string
    body: SemanticStatement[]
}

export interface SemanticModule {
    functions: SemanticFunction[]
    types: SemanticDataDeclaration[]
    globals: SemanticVariableDeclaration[]
}
