// AST for Clawr data structures and related constructs

export type ASTExpression =
    | ASTIntegerLiteral
    | ASTTruthValueLiteral
    | ASTIdentifier
    | ASTDataLiteral
    | ASTFieldAccess

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

export interface ASTDataDeclaration {
    kind: 'data-decl'
    name: string
    fields: { name: string; type: string }[]
}

export interface ASTDataLiteral {
    kind: 'data-literal'
    type: string // or reference to ASTDataDeclaration
    fields: { [field: string]: ASTExpression }
}

export interface ASTFieldAccess {
    kind: 'field-access'
    object: ASTExpression
    field: string
}

export interface ASTFieldAssignment {
    kind: 'field-assign'
    target: ASTFieldAccess
    value: ASTExpression
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

export type ASTStatement =
    | ASTVariableDeclaration
    | ASTPrintStatement
    | ASTFieldAssignment
    | ASTDataDeclaration

export interface ASTModule {
    body: (ASTDataDeclaration | ASTStatement)[]
}
