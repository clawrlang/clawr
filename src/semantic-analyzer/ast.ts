import type {
    ASTDataDeclaration,
    ASTDataLiteral,
    ASTFunctionParameter,
    ASTIdentifier,
    ASTImportDeclaration,
    ASTIntegerLiteral,
    ASTObjectDeclaration,
    ASTPosition,
    ASTServiceDeclaration,
    ASTTruthValueLiteral,
} from '../ast'

export type SemanticImportDeclaration = ASTImportDeclaration

export interface SemanticFieldAccess {
    kind: 'field-access'
    object: SemanticExpression
    field: string
    position: ASTPosition
}

export interface SemanticCopyExpression {
    kind: 'copy'
    value: SemanticExpression
    position: ASTPosition
}

export interface SemanticCallExpression {
    kind: 'call'
    callee: SemanticExpression
    arguments: SemanticExpression[]
    position: ASTPosition
}

export type SemanticExpression =
    | ASTIntegerLiteral
    | ASTTruthValueLiteral
    | ASTIdentifier
    | ASTDataLiteral
    | SemanticCopyExpression
    | SemanticCallExpression
    | SemanticFieldAccess

export interface SemanticValueSet {
    type: string
}

export interface SemanticOwnershipEffects {
    retains?: SemanticExpression[]
    releases?: SemanticExpression[]
    mutates?: SemanticExpression[]
    releaseAtScopeExit?: boolean
    copyValueSemantics?: '__rc_ISOLATED' | '__rc_SHARED'
}

export interface SemanticVariableDeclaration {
    kind: 'var-decl'
    semantics: 'const' | 'mut' | 'ref'
    name: string
    valueSet: SemanticValueSet
    value: SemanticExpression
    ownership: SemanticOwnershipEffects
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
    ownership: SemanticOwnershipEffects
    position: ASTPosition
}

export interface SemanticIfStatement {
    kind: 'if'
    condition: SemanticExpression
    thenBranch: SemanticStatement[]
    elseBranch?: SemanticStatement[]
    position: ASTPosition
}

export interface SemanticWhileStatement {
    kind: 'while'
    condition: SemanticExpression
    body: SemanticStatement[]
    position: ASTPosition
}

export interface SemanticBreakStatement {
    kind: 'break'
    position: ASTPosition
}

export interface SemanticContinueStatement {
    kind: 'continue'
    position: ASTPosition
}

export interface SemanticReturnStatement {
    kind: 'return'
    value?: SemanticExpression
    position: ASTPosition
}

export type SemanticStatement =
    | SemanticVariableDeclaration
    | SemanticPrintStatement
    | SemanticAssignment
    | SemanticIfStatement
    | SemanticWhileStatement
    | SemanticBreakStatement
    | SemanticContinueStatement
    | SemanticReturnStatement

export interface SemanticDataDeclaration extends Omit<
    ASTDataDeclaration,
    'fields'
> {
    fields: Array<
        ASTDataDeclaration['fields'][number] & {
            isReferenceCounted: boolean
        }
    >
}

export type SemanticFunctionParameter = ASTFunctionParameter

export interface SemanticFunction {
    kind: 'function'
    name: string
    parameters: SemanticFunctionParameter[]
    returnType?: string
    body: SemanticStatement[]
}

export interface SemanticModule {
    imports: SemanticImportDeclaration[]
    functions: SemanticFunction[]
    types: SemanticDataDeclaration[]
    objects: ASTObjectDeclaration[]
    services: ASTServiceDeclaration[]
    globals: SemanticVariableDeclaration[]
}
