import type {
    ASTAssignment,
    ASTDataDeclaration,
    ASTExpression,
    ASTPosition,
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
    position?: ASTPosition
}

export interface SemanticPrintStatement {
    kind: 'print'
    value: SemanticExpression
    dispatchType: string
    position: ASTPosition
}

export type SemanticStatement =
    | SemanticVariableDeclaration
    | SemanticPrintStatement
    | ASTAssignment

export type SemanticDataDeclaration = ASTDataDeclaration

export interface SemanticProgram {
    body: (SemanticDataDeclaration | SemanticStatement)[]
}
