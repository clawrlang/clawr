// Minimal AST for const variable declaration and print

export type ASTExpression =
    | ASTIntegerLiteral
    | ASTTruthValueLiteral
    | ASTIdentifier

export interface ASTIntegerLiteral {
    kind: 'integer'
    value: bigint
}

export interface ASTTruthValueLiteral {
    kind: 'truthvalue'
    value: 'false' | 'ambiguous' | 'true'
}

export interface ASTIdentifier {
    kind: 'identifier'
    name: string
}

export interface ASTVariableDeclaration {
    kind: 'var-decl'
    semantics: 'const' | 'mut' | 'ref'
    name: string
    value: ASTExpression
}

export interface ASTPrintStatement {
    kind: 'print'
    value: ASTExpression
}

export type ASTStatement = ASTVariableDeclaration | ASTPrintStatement

export interface ASTModule {
    body: ASTStatement[]
}
