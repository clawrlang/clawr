import type {
    ASTAssignment,
    ASTBinaryExpression,
    ASTDataDeclaration,
    ASTDataLiteral,
    ASTExpression,
    ASTProgram,
    ASTStatement,
    ASTVariableDeclaration,
} from '../ast'
import type {
    SemanticAssignment,
    SemanticDataDeclaration,
    SemanticFieldAccess,
    SemanticFunction,
    SemanticModule,
    SemanticOwnershipEffects,
    SemanticPrintStatement,
    SemanticStatement,
    SemanticVariableDeclaration,
} from './ast'

export type {
    SemanticAssignment,
    SemanticDataDeclaration,
    SemanticFieldAccess,
    SemanticFunction,
    SemanticModule,
    SemanticOwnershipEffects,
    SemanticPrintStatement,
    SemanticStatement,
    SemanticExpression,
    SemanticValueSet,
    SemanticVariableDeclaration,
} from './ast'

export class SemanticAnalyzer {
    private bindings = new Map<string, string>()
    private dataTypes = new Map<string, Map<string, string>>()

    constructor(private ast: ASTProgram) {}

    analyze(): SemanticModule {
        const types: SemanticDataDeclaration[] = []
        const mainBody: SemanticStatement[] = []

        for (const stmt of this.ast.body) {
            if (stmt.kind === 'data-decl') {
                this.registerDataDeclaration(stmt)
                types.push(stmt)
                continue
            }

            mainBody.push(this.analyzeStatement(stmt))
        }

        const mainFunction: SemanticFunction = {
            kind: 'function',
            name: 'main',
            body: mainBody,
        }

        return {
            functions: [mainFunction],
            types,
            globals: [],
        }
    }

    private analyzeStatement(stmt: ASTStatement): SemanticStatement {
        switch (stmt.kind) {
            case 'data-decl':
                throw new Error('Unexpected data declaration in statement body')
            case 'var-decl':
                return this.analyzeVariableDeclaration(stmt)
            case 'print':
                return this.analyzePrintStatement(stmt)
            case 'assign':
                return this.analyzeAssignment(stmt)
            default:
                return stmt
        }
    }

    private analyzePrintStatement(
        stmt: Extract<ASTStatement, { kind: 'print' }>,
    ): SemanticPrintStatement {
        const dispatchType = this.inferExpressionType(stmt.value)
        if (!dispatchType) {
            throw new Error(
                `${stmt.position.line}:${stmt.position.column}:Cannot infer print dispatch type from '${stmt.value.kind}'`,
            )
        }

        return {
            ...stmt,
            value: this.rewriteExpression(stmt.value),
            dispatchType,
        }
    }

    private analyzeAssignment(stmt: ASTAssignment): SemanticAssignment {
        if (!this.isAssignableTarget(stmt.target)) {
            throw new Error(
                `${stmt.position.line}:${stmt.position.column}:Invalid assignment target kind '${stmt.target.kind}'`,
            )
        }

        const targetType = this.inferExpressionType(stmt.target)
        const valueType = this.inferExpressionType(stmt.value)

        if (!targetType) {
            throw new Error(
                `${stmt.position.line}:${stmt.position.column}:Cannot infer type for assignment target '${stmt.target.kind}'`,
            )
        }

        if (!valueType) {
            throw new Error(
                `${stmt.position.line}:${stmt.position.column}:Cannot infer type for assignment value '${stmt.value.kind}'`,
            )
        }

        if (targetType !== valueType) {
            throw new Error(
                `${stmt.position.line}:${stmt.position.column}:Assignment type mismatch: target is '${targetType}' but value is '${valueType}'`,
            )
        }

        const rewrittenTarget = this.rewriteExpression(stmt.target)
        const rewrittenValue = this.rewriteExpression(stmt.value)

        return {
            kind: 'assign',
            target: rewrittenTarget,
            value: rewrittenValue,
            ownership: this.buildAssignmentOwnership(
                rewrittenTarget,
                rewrittenValue,
                targetType,
            ),
            position: stmt.position,
        }
    }

    private buildAssignmentOwnership(
        target: SemanticAssignment['target'],
        value: SemanticAssignment['value'],
        targetType: string,
    ): SemanticOwnershipEffects {
        if (target.kind === 'field-access') {
            return {
                mutates: this.collectMutateTargets(target),
            }
        }

        if (target.kind === 'identifier' && this.isReferenceType(targetType)) {
            return {
                retains: [value],
                releases: [target],
            }
        }

        return {}
    }

    private isAssignableTarget(target: ASTExpression): boolean {
        return (
            target.kind === 'identifier' ||
            (target.kind === 'binary' && target.operator === '.')
        )
    }

    private rewriteExpression(
        expr: ASTExpression,
    ): SemanticFieldAccess | Exclude<ASTExpression, ASTBinaryExpression> {
        if (expr.kind !== 'binary') return expr

        if (expr.operator !== '.') {
            throw new Error(
                `${expr.position.line}:${expr.position.column}:Unsupported binary operator '${expr.operator}'`,
            )
        }
        if (expr.right.kind !== 'identifier') {
            throw new Error(
                `${expr.right.position.line}:${expr.right.position.column}:Field name must be an identifier`,
            )
        }
        return {
            kind: 'field-access',
            object: this.rewriteExpression(expr.left),
            field: expr.right.name,
            position: expr.position,
        }
    }

    private registerDataDeclaration(stmt: ASTDataDeclaration) {
        this.dataTypes.set(
            stmt.name,
            new Map(stmt.fields.map((field) => [field.name, field.type])),
        )
    }

    private analyzeVariableDeclaration(
        stmt: ASTVariableDeclaration,
    ): SemanticVariableDeclaration {
        const explicitType = stmt.valueSet?.type

        if (explicitType) {
            this.validateInitializerAgainstType(stmt.value, explicitType)
            this.bindings.set(stmt.name, explicitType)
            const rewrittenValue = this.rewriteExpression(stmt.value)
            return {
                ...stmt,
                valueSet: { type: explicitType },
                value: rewrittenValue,
                ownership: this.buildVariableOwnership(
                    stmt.name,
                    explicitType,
                    rewrittenValue,
                ),
            }
        }

        const inferredType = this.inferExpressionType(stmt.value)
        if (!inferredType) {
            throw new Error(
                `${stmt.position.line}:${stmt.position.column}:Cannot infer type for variable '${stmt.name}' from '${stmt.value.kind}' initializer`,
            )
        }

        this.bindings.set(stmt.name, inferredType)
        const rewrittenValue = this.rewriteExpression(stmt.value)
        return {
            ...stmt,
            valueSet: { type: inferredType },
            value: rewrittenValue,
            ownership: this.buildVariableOwnership(
                stmt.name,
                inferredType,
                rewrittenValue,
            ),
        }
    }

    private buildVariableOwnership(
        name: string,
        type: string,
        value: SemanticVariableDeclaration['value'],
    ): SemanticOwnershipEffects {
        if (!this.isReferenceType(type)) return {}

        return {
            retains:
                value.kind === 'data-literal'
                    ? []
                    : [
                          {
                              kind: 'identifier',
                              name,
                              position: value.position,
                          },
                      ],
            releaseAtScopeExit: true,
        }
    }

    private isReferenceType(type: string): boolean {
        return this.dataTypes.has(type)
    }

    private collectMutateTargets(
        target: SemanticFieldAccess,
    ): SemanticFieldAccess['object'][] {
        const mutates: SemanticFieldAccess['object'][] = []

        const collect = (expr: SemanticFieldAccess['object']) => {
            mutates.push(expr)
            if (expr.kind === 'field-access') collect(expr.object)
        }

        collect(target.object)
        return mutates.reverse()
    }

    private validateInitializerAgainstType(
        value: ASTExpression,
        expected: string,
    ) {
        if (value.kind === 'data-literal') {
            this.validateDataLiteral(value, expected)
            return
        }

        const inferred = this.inferExpressionType(value)
        if (inferred && inferred !== expected) {
            throw new Error(
                `${value.position.line}:${value.position.column}:Type mismatch: expected '${expected}' but got '${inferred}'`,
            )
        }
    }

    private validateDataLiteral(value: ASTDataLiteral, expectedType: string) {
        const expectedFields = this.dataTypes.get(expectedType)
        if (!expectedFields) return

        for (const fieldName of expectedFields.keys()) {
            if (!(fieldName in value.fields)) {
                throw new Error(
                    `${value.position.line}:${value.position.column}:Missing field '${fieldName}' for data type '${expectedType}'`,
                )
            }
        }

        for (const [fieldName, fieldValue] of Object.entries(value.fields)) {
            const expectedFieldType = expectedFields.get(fieldName)
            if (!expectedFieldType) {
                throw new Error(
                    `${value.position.line}:${value.position.column}:Unknown field '${fieldName}' for data type '${expectedType}'`,
                )
            }

            const inferredFieldType = this.inferExpressionType(fieldValue)
            if (!inferredFieldType || inferredFieldType !== expectedFieldType) {
                throw new Error(
                    `${fieldValue.position.line}:${fieldValue.position.column}:Type mismatch for field '${fieldName}': expected '${expectedFieldType}' but got '${inferredFieldType ?? fieldValue.kind}'`,
                )
            }
        }
    }

    private inferExpressionType(value: ASTExpression): string | null {
        switch (value.kind) {
            case 'truthvalue':
                return 'truthvalue'
            case 'integer':
                return 'integer'
            case 'identifier': {
                const type = this.bindings.get(value.name)
                if (!type) {
                    throw new Error(
                        `${value.position.line}:${value.position.column}:Unknown identifier '${value.name}'`,
                    )
                }
                return type
            }
            case 'binary': {
                if (value.operator !== '.') return null
                if (value.right.kind !== 'identifier') return null
                const objectType = this.inferExpressionType(value.left)
                if (!objectType) {
                    throw new Error(
                        `${value.position.line}:${value.position.column}:Cannot infer type for dot access object`,
                    )
                }
                const fields = this.dataTypes.get(objectType)
                if (!fields) {
                    throw new Error(
                        `${value.position.line}:${value.position.column}:Cannot resolve field '${value.right.name}' on non-data type '${objectType}'`,
                    )
                }
                const fieldType = fields.get(value.right.name)
                if (!fieldType) {
                    throw new Error(
                        `${value.position.line}:${value.position.column}:Unknown field '${value.right.name}' on data type '${objectType}'`,
                    )
                }
                return fieldType
            }
            case 'data-literal':
                return null
            default:
                return null
        }
    }
}
