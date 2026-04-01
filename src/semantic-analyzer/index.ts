import type {
    ASTAssignment,
    ASTDataDeclaration,
    ASTDataLiteral,
    ASTExpression,
    ASTProgram,
    ASTStatement,
    ASTVariableDeclaration,
} from '../ast'
import type {
    SemanticDataDeclaration,
    SemanticProgram,
    SemanticStatement,
    SemanticVariableDeclaration,
} from './ast'

export type {
    SemanticDataDeclaration,
    SemanticProgram,
    SemanticStatement,
    SemanticExpression,
    SemanticValueSet,
    SemanticVariableDeclaration,
} from './ast'

export class SemanticAnalyzer {
    private bindings = new Map<string, string>()
    private dataTypes = new Map<string, Map<string, string>>()

    constructor(private ast: ASTProgram) {}

    analyze(): SemanticProgram {
        return {
            body: this.ast.body.map((stmt) => this.analyzeNode(stmt)),
        }
    }

    private analyzeNode(
        stmt: ASTStatement | ASTDataDeclaration,
    ): SemanticStatement | SemanticDataDeclaration {
        switch (stmt.kind) {
            case 'data-decl':
                this.registerDataDeclaration(stmt)
                return stmt
            case 'var-decl':
                return this.analyzeVariableDeclaration(stmt)
            case 'assign':
                return this.analyzeAssignment(stmt)
            default:
                return stmt
        }
    }

    private analyzeAssignment(stmt: ASTAssignment): ASTAssignment {
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

        return stmt
    }

    private isAssignableTarget(target: ASTExpression): boolean {
        return target.kind === 'identifier' || target.kind === 'field-access'
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
            return {
                ...stmt,
                valueSet: { type: explicitType },
            }
        }

        const inferredType = this.inferExpressionType(stmt.value)
        if (!inferredType) {
            throw new Error(
                `${stmt.position.line}:${stmt.position.column}:Cannot infer type for variable '${stmt.name}' from '${stmt.value.kind}' initializer`,
            )
        }

        this.bindings.set(stmt.name, inferredType)
        return {
            ...stmt,
            valueSet: { type: inferredType },
        }
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
                    throw new Error(`${value.position.line}:${value.position.column}:Unknown identifier '${value.name}'`)
                }
                return type
            }
            case 'field-access': {
                const objectType = this.inferExpressionType(value.object)
                if (!objectType) {
                    throw new Error(
                        `${value.position.line}:${value.position.column}:Cannot infer type for field access object '${value.field}'`,
                    )
                }
                const fields = this.dataTypes.get(objectType)
                if (!fields) {
                    throw new Error(
                        `${value.position.line}:${value.position.column}:Cannot resolve field '${value.field}' on non-data type '${objectType}'`,
                    )
                }
                const fieldType = fields.get(value.field)
                if (!fieldType) {
                    throw new Error(
                        `${value.position.line}:${value.position.column}:Unknown field '${value.field}' on data type '${objectType}'`,
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
