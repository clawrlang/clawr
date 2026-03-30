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
    valueSet: ASTValueSet
    value: ASTExpression
}

// Placeholder for lattice information. This will be used for various analyses
// and optimizations, but for now we just need to represent the 'top' set of
// each lattice — all possible values — represented by its type. In the future,
// this will need to be more complex to support different restrictions on the
// values, e.g., for integers we might want to represent a range, and for truth
// values we might want to represent subsets of {false, ambiguous, true}. For
// now, we just use a simple type field to represent the top of the lattice.
type ASTValueSet = {
    type: string
}

export interface ASTPrintStatement {
    kind: 'print'
    value: ASTExpression
}

export type ASTStatement = ASTVariableDeclaration | ASTPrintStatement

export interface ASTModule {
    body: ASTStatement[]
}
