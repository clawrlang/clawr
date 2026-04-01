import type {
    ASTAssignment,
    ASTDataDeclaration,
    ASTExpression,
    ASTPrintStatement,
} from '../ast'

export type SemanticExpression = ASTExpression

export interface SemanticValueSet {
    type: string
}

export interface SemanticVariableDeclaration {
    kind: 'var-decl'
    semantics: 'const' | 'mut' | 'ref'
    name: string
    valueSet: SemanticValueSet
    value: SemanticExpression
}

export type SemanticStatement =
    | SemanticVariableDeclaration
    | ASTPrintStatement
    | ASTAssignment

export type SemanticDataDeclaration = ASTDataDeclaration

export interface SemanticProgram {
    body: (SemanticDataDeclaration | SemanticStatement)[]
}
