// AST for Clawr data structures and related constructs

export interface ASTPosition {
    line: number
    column: number
}

// ----- Expressions -----
export type ASTExpression =
    | ASTIntegerLiteral
    | ASTTruthValueLiteral
    | ASTIdentifier
    | ASTDataLiteral
    | ASTCopyExpression
    | ASTBinaryExpression

export interface ASTIntegerLiteral {
    kind: 'integer'
    value: bigint
    position: ASTPosition
}

export interface ASTTruthValueLiteral {
    kind: 'truthvalue'
    value: 'false' | 'ambiguous' | 'true'
    position: ASTPosition
}

export interface ASTIdentifier {
    kind: 'identifier'
    name: string
    position: ASTPosition
}

export interface ASTDataLiteral {
    kind: 'data-literal'
    fields: { [field: string]: ASTExpression }
    position: ASTPosition
}

export interface ASTCopyExpression {
    kind: 'copy'
    value: ASTExpression
    position: ASTPosition
}

export interface ASTBinaryExpression {
    kind: 'binary'
    operator: string
    left: ASTExpression
    right: ASTExpression
    position: ASTPosition
}

// ----- Statements -----
export type ASTStatement =
    | ASTVariableDeclaration
    | ASTPrintStatement
    | ASTAssignment
    | ASTIfStatement
    | ASTWhileStatement
    | ASTBreakStatement
    | ASTContinueStatement
    | ASTDataDeclaration

export interface ASTAssignment {
    kind: 'assign'
    target: ASTExpression
    value: ASTExpression
    position: ASTPosition
}

export interface ASTDataDeclaration {
    kind: 'data-decl'
    name: string
    fields: {
        semantics?: 'const' | 'mut' | 'ref'
        name: string
        type: string
        position?: ASTPosition
    }[]
    position: ASTPosition
}

export interface ASTIfStatement {
    kind: 'if'
    condition: ASTExpression
    thenBranch: ASTStatement[]
    elseBranch?: ASTStatement[]
    position: ASTPosition
}

export interface ASTWhileStatement {
    kind: 'while'
    condition: ASTExpression
    body: ASTStatement[]
    position: ASTPosition
}

export interface ASTBreakStatement {
    kind: 'break'
    position: ASTPosition
}

export interface ASTContinueStatement {
    kind: 'continue'
    position: ASTPosition
}

export interface ASTPrintStatement {
    kind: 'print'
    value: ASTExpression
    position: ASTPosition
}

export interface ASTVariableDeclaration {
    kind: 'var-decl'
    semantics: 'const' | 'mut' | 'ref'
    name: string
    valueSet?: ASTValueSet
    value: ASTExpression
    position: ASTPosition
}

// Placeholder for lattice information. This will be used for various analyses
// and optimizations, but for now we just need to represent the 'top' set of
// each lattice — all possible values — represented by its type. In the future,
// this will need to be more complex to support different restrictions on the
// values, e.g., for integers we might want to represent a range, and for truth
// values we might want to represent subsets of {false, ambiguous, true}. For
// now, we just use a simple type field to represent the top of the lattice.
export type ASTValueSet = {
    type: string
}

// ----- Top-level module structure -----
export interface ASTProgram {
    body: (ASTDataDeclaration | ASTStatement)[]
}
