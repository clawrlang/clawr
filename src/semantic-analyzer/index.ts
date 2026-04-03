import type {
    ASTAssignment,
    ASTDataDeclaration,
    ASTDataLiteral,
    ASTExpression,
    ASTFunctionDeclaration,
    ASTIdentifier,
    ASTProgram,
    ASTReturnStatement,
    ASTStatement,
    ASTVariableDeclaration,
} from '../ast'
import type { ASTObjectDeclaration, ASTServiceDeclaration } from '../ast'
import type {
    SemanticAssignment,
    SemanticCopyExpression,
    SemanticDataDeclaration,
    SemanticExpression,
    SemanticFieldAccess,
    SemanticFunction,
    SemanticModule,
    SemanticOwnershipEffects,
    SemanticPrintStatement,
    SemanticReturnStatement,
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
    SemanticReturnStatement,
    SemanticStatement,
    SemanticExpression,
    SemanticValueSet,
    SemanticVariableDeclaration,
} from './ast'

export class SemanticAnalyzer {
    private bindings: BindingMap = new Map()
    private dataTypes: Map<string, BindingMap>
    private functionSignatures: Map<string, FunctionSignature>

    constructor(
        private ast: ASTProgram,
        private parent?: SemanticAnalyzer,
        dataTypes?: Map<string, BindingMap>,
        functionSignatures?: Map<string, FunctionSignature>,
        private loopDepth = 0,
        private currentFunctionReturnType?: string,
        private currentOwnerType?: string,
        private currentOwnerKind?: 'object' | 'service',
        private currentMethodMutating = false,
    ) {
        this.dataTypes = dataTypes ?? parent?.dataTypes ?? new Map()
        this.functionSignatures =
            functionSignatures ?? parent?.functionSignatures ?? new Map()
    }

    analyze(): SemanticModule {
        const types: SemanticDataDeclaration[] = []
        const objects: ASTObjectDeclaration[] = []
        const services: ASTServiceDeclaration[] = []
        const mainBody: SemanticStatement[] = []
        const userFunctions: SemanticFunction[] = []

        // First pass: register all type and function names so forward references work.
        for (const stmt of this.ast.body) {
            if (stmt.kind === 'data-decl') {
                this.registerDataDeclaration(stmt)
                types.push(this.annotateDataDeclaration(stmt))
            }
            if (stmt.kind === 'func-decl') {
                this.bindings.set(stmt.name, {
                    type: 'func',
                    semantics: 'const',
                    declarationPosition: stmt.position,
                })
                const labels = stmt.parameters.map(
                    (param) => param.label ?? '_',
                )
                this.functionSignatures.set(
                    buildFunctionSignatureKey(stmt.name, labels),
                    {
                        name: stmt.name,
                        visibility: stmt.visibility,
                        labels,
                        returnType: stmt.returnType,
                        arity: stmt.parameters.length,
                        parameterTypes: stmt.parameters.map(
                            (param) => param.type,
                        ),
                    },
                )
            }
            if (stmt.kind === 'object-decl') {
                this.registerTypeDeclaration(stmt)
                this.registerMethodSignatures(stmt.name, stmt.sections)
                objects.push(stmt)
            }
            if (stmt.kind === 'service-decl') {
                this.registerTypeDeclaration(stmt)
                this.registerMethodSignatures(stmt.name, stmt.sections)
                services.push(stmt)
            }
        }

        this.validateDataFieldSemantics(types)

        // Second pass: analyze function bodies and module-level statements.
        const mainScopedAnalyzer = this.createChildScope()
        for (const stmt of this.ast.body) {
            if (stmt.kind === 'func-decl') {
                userFunctions.push(this.analyzeFunctionDeclaration(stmt))
                continue
            }
            if (stmt.kind === 'object-decl') {
                this.analyzeTypeMethods(stmt.name, 'object', stmt.sections)
                continue
            }
            if (stmt.kind === 'service-decl') {
                this.analyzeTypeMethods(stmt.name, 'service', stmt.sections)
                continue
            }
            if (stmt.kind === 'data-decl') continue
            mainBody.push(mainScopedAnalyzer.analyzeStatement(stmt))
        }

        const mainFunction: SemanticFunction = {
            kind: 'function',
            name: 'main',
            parameters: [],
            body: mainBody,
        }

        return {
            imports: this.ast.imports.map((imp) => ({
                ...imp,
                items: imp.items.map((item) => ({ ...item })),
            })),
            functions: [mainFunction, ...userFunctions],
            types,
            objects,
            services,
            globals: [],
        }
    }

    private createChildScope(): SemanticAnalyzer {
        return new SemanticAnalyzer(
            this.ast,
            this,
            this.dataTypes,
            this.functionSignatures,
            this.loopDepth,
            this.currentFunctionReturnType,
            this.currentOwnerType,
            this.currentOwnerKind,
            this.currentMethodMutating,
        )
    }

    private createLoopChildScope(): SemanticAnalyzer {
        return new SemanticAnalyzer(
            this.ast,
            this,
            this.dataTypes,
            this.functionSignatures,
            this.loopDepth + 1,
            this.currentFunctionReturnType,
            this.currentOwnerType,
            this.currentOwnerKind,
            this.currentMethodMutating,
        )
    }

    private createFunctionChildScope(
        returnType?: string,
        ownerType?: string,
        ownerKind?: 'object' | 'service',
        methodMutating = false,
    ): SemanticAnalyzer {
        return new SemanticAnalyzer(
            this.ast,
            this,
            this.dataTypes,
            this.functionSignatures,
            0, // reset loop depth — break/continue inside a nested function is not the outer loop's
            returnType,
            ownerType,
            ownerKind,
            methodMutating,
        )
    }

    private analyzeStatement(stmt: ASTStatement): SemanticStatement {
        switch (stmt.kind) {
            case 'data-decl':
                throw new Error('Unexpected data declaration in statement body')
            case 'func-decl':
                throw new Error(
                    'Unexpected function declaration in statement body',
                )
            case 'object-decl':
                throw new Error(
                    'Unexpected object declaration in statement body',
                )
            case 'service-decl':
                throw new Error(
                    'Unexpected service declaration in statement body',
                )
            case 'var-decl':
                return this.analyzeVariableDeclaration(stmt)
            case 'print':
                return this.analyzePrintStatement(stmt)
            case 'assign':
                return this.analyzeAssignment(stmt)
            case 'if':
                return this.analyzeIfStatement(stmt)
            case 'while':
                return this.analyzeWhileStatement(stmt)
            case 'break':
                return this.analyzeBreakStatement(stmt)
            case 'continue':
                return this.analyzeContinueStatement(stmt)
            case 'return':
                return this.analyzeReturnStatement(stmt)
            default:
                return stmt
        }
    }

    private analyzeReturnStatement(
        stmt: ASTReturnStatement,
    ): SemanticReturnStatement {
        if (stmt.value === undefined) {
            if (this.currentFunctionReturnType !== undefined) {
                throw new Error(
                    `${stmt.position.line}:${stmt.position.column}:Return statement requires a value of type '${this.currentFunctionReturnType}'`,
                )
            }

            return { kind: 'return', position: stmt.position }
        }

        // Validate the return expression first so specific diagnostics like
        // unknown identifiers surface before the enclosing function contract.
        const returnType = this.inferExpressionType(stmt.value)

        if (this.currentFunctionReturnType === undefined) {
            throw new Error(
                `${stmt.position.line}:${stmt.position.column}:Cannot return a value from a function without a return type annotation`,
            )
        }

        if (returnType && returnType !== this.currentFunctionReturnType) {
            throw new Error(
                `${stmt.position.line}:${stmt.position.column}:Return type mismatch: expected '${this.currentFunctionReturnType}' but got '${returnType}'`,
            )
        }

        return {
            kind: 'return',
            value: this.rewriteExpression(stmt.value),
            position: stmt.position,
        }
    }

    private analyzeIfStatement(
        stmt: Extract<ASTStatement, { kind: 'if' }>,
    ): SemanticStatement {
        this.assertTruthvalueCondition(stmt.condition, stmt.position, 'if')

        const thenAnalyzer = this.createChildScope()
        const thenBranch = stmt.thenBranch.map((child) =>
            thenAnalyzer.analyzeStatement(child),
        )

        const elseBranch = stmt.elseBranch
            ? (() => {
                  const elseAnalyzer = this.createChildScope()
                  return stmt.elseBranch.map((child) =>
                      elseAnalyzer.analyzeStatement(child),
                  )
              })()
            : undefined

        return {
            kind: 'if',
            condition: this.rewriteExpression(stmt.condition),
            thenBranch,
            elseBranch,
            position: stmt.position,
        }
    }

    private analyzeWhileStatement(
        stmt: Extract<ASTStatement, { kind: 'while' }>,
    ): SemanticStatement {
        this.assertTruthvalueCondition(stmt.condition, stmt.position, 'while')

        const loopAnalyzer = this.createLoopChildScope()
        const body = stmt.body.map((child) =>
            loopAnalyzer.analyzeStatement(child),
        )

        return {
            kind: 'while',
            condition: this.rewriteExpression(stmt.condition),
            body,
            position: stmt.position,
        }
    }

    private analyzeBreakStatement(
        stmt: Extract<ASTStatement, { kind: 'break' }>,
    ): SemanticStatement {
        if (this.loopDepth <= 0) {
            throw new Error(
                `${stmt.position.line}:${stmt.position.column}:break is only allowed inside a while loop`,
            )
        }

        return stmt
    }

    private analyzeContinueStatement(
        stmt: Extract<ASTStatement, { kind: 'continue' }>,
    ): SemanticStatement {
        if (this.loopDepth <= 0) {
            throw new Error(
                `${stmt.position.line}:${stmt.position.column}:continue is only allowed inside a while loop`,
            )
        }

        return stmt
    }

    private assertTruthvalueCondition(
        condition: ASTExpression,
        position: { line: number; column: number },
        keyword: 'if' | 'while',
    ): void {
        const conditionType = this.inferExpressionType(condition)
        if (conditionType !== 'truthvalue') {
            throw new Error(
                `${position.line}:${position.column}:${keyword} condition must be truthvalue, got '${conditionType ?? condition.kind}'`,
            )
        }
    }

    private analyzePrintStatement(
        stmt: Extract<ASTStatement, { kind: 'print' }>,
    ): SemanticPrintStatement {
        if (this.currentOwnerKind === 'object') {
            throw new Error(
                `${stmt.position.line}:${stmt.position.column}:Object methods may not perform external side-effects (print)`,
            )
        }

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

        this.validateMethodAssignmentRules(stmt.target, stmt.position)

        this.validateAssignmentMutationSemantics(stmt.target)

        const targetType = this.inferExpressionType(stmt.target)
        const valueType = this.inferExpressionType(stmt.value)
        const targetSemantics = this.inferExpressionSemantics(stmt.target)
        const valueSemantics = this.inferExpressionSemantics(stmt.value)

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

        this.validateSemanticBoundary(
            targetType,
            targetSemantics,
            valueSemantics,
            rewrittenValue,
            stmt.position,
        )

        return {
            kind: 'assign',
            target: rewrittenTarget,
            value: rewrittenValue,
            ownership: this.buildAssignmentOwnership(
                rewrittenTarget,
                rewrittenValue,
                targetType,
                targetSemantics,
                valueSemantics,
            ),
            position: stmt.position,
        }
    }

    private buildAssignmentOwnership(
        target: SemanticAssignment['target'],
        value: SemanticAssignment['value'],
        targetType: string,
        targetSemantics: ASTVariableDeclaration['semantics'] | null,
        valueSemantics: ASTVariableDeclaration['semantics'] | null,
    ): SemanticOwnershipEffects {
        if (target.kind === 'field-access') {
            const ownership: SemanticOwnershipEffects = {
                mutates: this.collectMutateTargets(target),
            }

            if (
                this.isReferenceType(targetType) &&
                this.isCopyExpression(value)
            ) {
                ownership.copyValueSemantics =
                    this.toRuntimeSemanticsFlag(targetSemantics)
            }

            return ownership
        }

        if (target.kind === 'identifier' && this.isReferenceType(targetType)) {
            if (this.isCopyExpression(value)) {
                return {
                    releases: [target],
                    copyValueSemantics:
                        this.toRuntimeSemanticsFlag(targetSemantics),
                }
            }

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

    private rewriteExpression(expr: ASTExpression): SemanticExpression {
        if (expr.kind === 'copy') {
            return {
                ...expr,
                value: this.rewriteExpression(expr.value),
            }
        }

        if (expr.kind === 'call') {
            if (
                expr.callee.kind === 'binary' &&
                expr.callee.operator === '.' &&
                expr.callee.right.kind === 'identifier'
            ) {
                const receiverType = this.inferExpressionType(expr.callee.left)
                if (!receiverType) {
                    throw new Error(
                        `${expr.callee.position.line}:${expr.callee.position.column}:Cannot infer type for method call receiver`,
                    )
                }

                return {
                    kind: 'call',
                    callee: {
                        kind: 'identifier',
                        name: `${receiverType}·${expr.callee.right.name}`,
                        position: expr.callee.right.position,
                    },
                    arguments: [
                        {
                            value: this.rewriteExpression(expr.callee.left),
                        },
                        ...expr.arguments.map((arg) => ({
                            label: arg.label,
                            value: this.rewriteExpression(arg.value),
                        })),
                    ],
                    position: expr.position,
                }
            }

            return {
                kind: 'call',
                callee: this.rewriteExpression(expr.callee),
                arguments: expr.arguments.map((arg) => ({
                    label: arg.label,
                    value: this.rewriteExpression(arg.value),
                })),
                position: expr.position,
            }
        }

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

    private analyzeFunctionDeclaration(
        stmt: ASTFunctionDeclaration,
    ): SemanticFunction {
        this.validateMethodDeclarationRules(stmt)

        const bodyAnalyzer = this.createFunctionChildScope(
            stmt.returnType,
            this.currentOwnerType,
            this.currentOwnerKind,
            this.currentMethodMutating,
        )

        // Inject parameters as bindings in the function scope.
        for (const param of stmt.parameters) {
            bodyAnalyzer.bindings.set(param.name, {
                type: param.type,
                semantics: param.semantics ?? 'const',
                declarationPosition: param.position,
            })
        }

        const body = this.analyzeFunctionBody(stmt, bodyAnalyzer)

        return {
            kind: 'function',
            name: stmt.name,
            parameters: stmt.parameters,
            returnType: stmt.returnType,
            body,
        }
    }

    private validateMethodDeclarationRules(stmt: ASTFunctionDeclaration): void {
        if (!this.currentOwnerType) return
        if (this.currentMethodMutating) return
        if (stmt.returnType !== undefined) return

        throw new Error(
            `${stmt.position.line}:${stmt.position.column}:Immutable method '${this.currentOwnerType}.${stmt.name}' must declare a return type`,
        )
    }

    private analyzeFunctionBody(
        stmt: ASTFunctionDeclaration,
        bodyAnalyzer: SemanticAnalyzer,
    ): SemanticStatement[] {
        if (stmt.body.kind === 'block') {
            return stmt.body.statements.map((s) =>
                bodyAnalyzer.analyzeStatement(s),
            )
        }

        // Shorthand `=> expr` body: treat as a single implicit return.
        if (stmt.returnType === undefined) {
            throw new Error(
                `${stmt.position.line}:${stmt.position.column}:Shorthand body '=> expr' requires a return type annotation on function '${stmt.name}'`,
            )
        }

        return [
            bodyAnalyzer.analyzeReturnStatement({
                kind: 'return',
                value: stmt.body.value,
                position: stmt.body.value.position,
            }),
        ]
    }

    private registerTypeDeclaration(
        stmt: ASTObjectDeclaration | ASTServiceDeclaration,
    ) {
        // Register the type name in dataTypes with an empty binding map.
        // Full method resolution is deferred to a later slice.
        this.dataTypes.set(stmt.name, new Map())
    }

    private registerMethodSignatures(
        ownerType: string,
        sections: ASTObjectDeclaration['sections'],
    ) {
        for (const section of sections) {
            if (section.kind !== 'methods' && section.kind !== 'mutating') {
                continue
            }

            for (const method of section.items) {
                const callableParams =
                    method.parameters[0]?.name === 'self'
                        ? method.parameters.slice(1)
                        : method.parameters
                const labels = callableParams.map((param) => param.label ?? '_')

                this.functionSignatures.set(
                    buildFunctionSignatureKey(method.name, labels, ownerType),
                    {
                        name: method.name,
                        ownerType,
                        visibility: method.visibility,
                        labels,
                        returnType: method.returnType,
                        arity: callableParams.length,
                        parameterTypes: callableParams.map(
                            (param) => param.type,
                        ),
                    },
                )
            }
        }
    }

    private analyzeTypeMethods(
        ownerType: string,
        ownerKind: 'object' | 'service',
        sections: ASTObjectDeclaration['sections'],
    ): void {
        for (const section of sections) {
            if (section.kind !== 'methods' && section.kind !== 'mutating') {
                continue
            }

            for (const method of section.items) {
                const methodAnalyzer = this.createFunctionChildScope(
                    method.returnType,
                    ownerType,
                    ownerKind,
                    section.kind === 'mutating',
                )
                methodAnalyzer.analyzeFunctionDeclaration(method)
            }
        }
    }

    private validateMethodAssignmentRules(
        target: ASTExpression,
        position: { line: number; column: number },
    ): void {
        if (!this.currentOwnerType) return

        if (
            !this.currentMethodMutating &&
            target.kind === 'binary' &&
            target.operator === '.'
        ) {
            throw new Error(
                `${position.line}:${position.column}:Immutable method '${this.currentOwnerType}' may not assign to a field`,
            )
        }

        if (this.currentOwnerKind !== 'object') return

        const root = this.extractRootIdentifier(target)
        if (
            target.kind === 'binary' &&
            target.operator === '.' &&
            root &&
            root.name !== 'self'
        ) {
            throw new Error(
                `${position.line}:${position.column}:Object methods may not mutate external state via '${root.name}'`,
            )
        }
    }

    private registerDataDeclaration(stmt: ASTDataDeclaration) {
        this.dataTypes.set(
            stmt.name,
            new Map(
                stmt.fields.map((field) => [
                    field.name,
                    {
                        type: field.type,
                        semantics: field.semantics ?? 'mut',
                        declarationPosition: field.position,
                    },
                ]),
            ),
        )
    }

    private annotateDataDeclaration(
        stmt: ASTDataDeclaration,
    ): SemanticDataDeclaration {
        return {
            ...stmt,
            fields: stmt.fields.map((field) => ({
                ...field,
                isReferenceCounted: this.dataTypes.has(field.type),
            })),
        }
    }

    private lookupDataType(name: string): BindingMap | undefined {
        const dataType = this.dataTypes.get(name)
        if (dataType || !this.parent) return dataType
        return this.parent.lookupDataType(name)
    }

    private validateDataFieldSemantics(
        declarations: SemanticDataDeclaration[],
    ): void {
        for (const decl of declarations) {
            for (const field of decl.fields) {
                const semantics = field.semantics ?? 'mut'

                if (semantics === 'const') {
                    throw new Error(
                        `${decl.position.line}:${decl.position.column}:Field '${field.name}' in data type '${decl.name}' cannot use 'const' semantics`,
                    )
                }

                if (semantics === 'ref' && !this.isReferenceType(field.type)) {
                    throw new Error(
                        `${decl.position.line}:${decl.position.column}:Field '${field.name}' in data type '${decl.name}' cannot use 'ref' semantics with non-reference type '${field.type}'`,
                    )
                }
            }
        }
    }

    private analyzeVariableDeclaration(
        stmt: ASTVariableDeclaration,
    ): SemanticVariableDeclaration {
        const explicitType = stmt.valueSet?.type
        const valueSemantics = this.inferExpressionSemantics(stmt.value)

        if (explicitType) {
            this.validateInitializerAgainstType(stmt.value, explicitType)
            this.declareBinding(
                stmt.name,
                {
                    type: explicitType,
                    semantics: stmt.semantics,
                },
                stmt.position,
            )
            const rewrittenValue = this.rewriteExpression(stmt.value)

            this.validateSemanticBoundary(
                explicitType,
                stmt.semantics,
                valueSemantics,
                rewrittenValue,
                stmt.position,
            )

            return {
                ...stmt,
                valueSet: { type: explicitType },
                value: rewrittenValue,
                ownership: this.buildVariableOwnership(
                    stmt.name,
                    explicitType,
                    rewrittenValue,
                    stmt.semantics,
                    valueSemantics,
                ),
            }
        }

        const inferredType = this.inferExpressionType(stmt.value)
        if (!inferredType) {
            throw new Error(
                `${stmt.position.line}:${stmt.position.column}:Cannot infer type for variable '${stmt.name}' from '${stmt.value.kind}' initializer`,
            )
        }

        this.declareBinding(
            stmt.name,
            {
                type: inferredType,
                semantics: stmt.semantics,
            },
            stmt.position,
        )
        const rewrittenValue = this.rewriteExpression(stmt.value)

        this.validateSemanticBoundary(
            inferredType,
            stmt.semantics,
            valueSemantics,
            rewrittenValue,
            stmt.position,
        )

        return {
            ...stmt,
            valueSet: { type: inferredType },
            value: rewrittenValue,
            ownership: this.buildVariableOwnership(
                stmt.name,
                inferredType,
                rewrittenValue,
                stmt.semantics,
                valueSemantics,
            ),
        }
    }

    private buildVariableOwnership(
        name: string,
        type: string,
        value: SemanticVariableDeclaration['value'],
        targetSemantics: ASTVariableDeclaration['semantics'],
        valueSemantics: ASTVariableDeclaration['semantics'] | null,
    ): SemanticOwnershipEffects {
        if (!this.isReferenceType(type)) return {}

        const ownership: SemanticOwnershipEffects = {
            releaseAtScopeExit: true,
        }

        if (this.isCopyExpression(value)) {
            ownership.copyValueSemantics =
                this.toRuntimeSemanticsFlag(targetSemantics)
            return ownership
        }

        ownership.retains =
            value.kind === 'data-literal'
                ? []
                : [
                      {
                          kind: 'identifier',
                          name,
                          position: value.position,
                      },
                  ]

        return ownership
    }

    private isReferenceType(type: string): boolean {
        return Boolean(this.lookupDataType(type))
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
        const expectedFields = this.lookupDataType(expectedType)
        if (!expectedFields) return

        for (const [fieldName, fieldInfo] of expectedFields.entries()) {
            if (!(fieldName in value.fields)) {
                const position = fieldInfo.declarationPosition ?? value.position
                throw new Error(
                    `${position.line}:${position.column}:Missing field '${fieldName}' for data type '${expectedType}'`,
                )
            }
        }

        for (const [fieldName, fieldValue] of Object.entries(value.fields)) {
            const expectedFieldInfo = expectedFields.get(fieldName)
            if (!expectedFieldInfo) {
                throw new Error(
                    `${fieldValue.position.line}:${fieldValue.position.column}:Unknown field '${fieldName}' for data type '${expectedType}'`,
                )
            }

            const inferredFieldType = this.inferExpressionType(fieldValue)
            if (
                !inferredFieldType ||
                inferredFieldType !== expectedFieldInfo.type
            ) {
                throw new Error(
                    `${fieldValue.position.line}:${fieldValue.position.column}:Type mismatch for field '${fieldName}': expected '${expectedFieldInfo.type}' but got '${inferredFieldType ?? fieldValue.kind}'`,
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
            case 'call': {
                const argumentLabels = value.arguments.map(
                    (arg) => arg.label ?? '_',
                )

                let signature: FunctionSignature | undefined
                let calleeName: string

                if (value.callee.kind === 'identifier') {
                    calleeName = value.callee.name
                    const calleeBinding = this.lookupBinding(value.callee.name)
                    if (!calleeBinding) {
                        throw new Error(
                            `${value.callee.position.line}:${value.callee.position.column}:Unknown identifier '${value.callee.name}'`,
                        )
                    }

                    if (calleeBinding.type !== 'func') {
                        throw new Error(
                            `${value.callee.position.line}:${value.callee.position.column}:Cannot call non-function identifier '${value.callee.name}'`,
                        )
                    }

                    signature = this.lookupFunctionSignature(
                        buildFunctionSignatureKey(calleeName, argumentLabels),
                    )

                    if (!signature) {
                        const overloads =
                            this.lookupFunctionSignaturesByName(calleeName)
                        const suggestion = buildDidYouMeanSignatureHint(
                            calleeName,
                            overloads,
                        )
                        throw new Error(
                            `${value.position.line}:${value.position.column}:Function/method not found '${renderFunctionSignature(calleeName, argumentLabels)}'.${suggestion}`,
                        )
                    }
                } else if (
                    value.callee.kind === 'binary' &&
                    value.callee.operator === '.' &&
                    value.callee.right.kind === 'identifier'
                ) {
                    const receiverType = this.inferExpressionType(
                        value.callee.left,
                    )
                    if (!receiverType) {
                        throw new Error(
                            `${value.callee.position.line}:${value.callee.position.column}:Cannot infer type for method call receiver`,
                        )
                    }

                    calleeName = value.callee.right.name
                    signature = this.lookupFunctionSignature(
                        buildFunctionSignatureKey(
                            calleeName,
                            argumentLabels,
                            receiverType,
                        ),
                    )

                    if (!signature) {
                        const overloads = this.lookupFunctionSignaturesByName(
                            calleeName,
                            receiverType,
                        )
                        const suggestion = buildDidYouMeanSignatureHint(
                            calleeName,
                            overloads,
                            receiverType,
                        )
                        throw new Error(
                            `${value.position.line}:${value.position.column}:Function/method not found '${renderFunctionSignature(calleeName, argumentLabels, receiverType)}'.${suggestion}`,
                        )
                    }
                } else {
                    throw new Error(
                        `${value.position.line}:${value.position.column}:Unsupported call target '${value.callee.kind}'`,
                    )
                }

                if (
                    signature.ownerType &&
                    signature.visibility === 'helper' &&
                    this.currentOwnerType !== signature.ownerType
                ) {
                    throw new Error(
                        `${value.position.line}:${value.position.column}:Method '${renderFunctionSignature(calleeName, argumentLabels, signature.ownerType)}' is helper and only callable inside '${signature.ownerType}'`,
                    )
                }

                if (value.arguments.length !== signature.arity) {
                    throw new Error(
                        `${value.position.line}:${value.position.column}:Function '${calleeName}' expects ${signature.arity} argument(s), got ${value.arguments.length}`,
                    )
                }

                for (const arg of value.arguments) {
                    this.inferExpressionType(arg.value)
                }

                for (let i = 0; i < value.arguments.length; i++) {
                    const actualType = this.inferExpressionType(
                        value.arguments[i].value,
                    )
                    const expectedType = signature.parameterTypes[i]

                    if (
                        actualType &&
                        expectedType !== undefined &&
                        actualType !== expectedType
                    ) {
                        throw new Error(
                            `${value.arguments[i].value.position.line}:${value.arguments[i].value.position.column}:Argument ${i + 1} type mismatch for function '${calleeName}': expected '${expectedType}' but got '${actualType}'`,
                        )
                    }
                }

                if (signature.returnType === undefined) {
                    throw new Error(
                        `${value.position.line}:${value.position.column}:Function '${calleeName}' has no return type and cannot be used as a value`,
                    )
                }

                return signature.returnType
            }
            case 'identifier': {
                const binding = this.lookupBinding(value.name)
                if (!binding) {
                    throw new Error(
                        `${value.position.line}:${value.position.column}:Unknown identifier '${value.name}'`,
                    )
                }
                return binding.type
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
                const fields = this.lookupDataType(objectType)
                if (!fields) {
                    throw new Error(
                        `${value.position.line}:${value.position.column}:Cannot resolve field '${value.right.name}' on non-data type '${objectType}'`,
                    )
                }
                const fieldInfo = fields.get(value.right.name)
                if (!fieldInfo) {
                    throw new Error(
                        `${value.position.line}:${value.position.column}:Unknown field '${value.right.name}' on data type '${objectType}'`,
                    )
                }
                return fieldInfo.type
            }
            case 'copy': {
                const copiedType = this.inferExpressionType(value.value)
                if (!copiedType) {
                    throw new Error(
                        `${value.position.line}:${value.position.column}:Cannot infer type for copy value`,
                    )
                }
                if (!this.isReferenceType(copiedType)) {
                    throw new Error(
                        `${value.position.line}:${value.position.column}:copy(...) expects a reference-counted value, got '${copiedType}'`,
                    )
                }
                return copiedType
            }
            case 'data-literal':
                return null
            default:
                return null
        }
    }

    private validateAssignmentMutationSemantics(target: ASTExpression): void {
        if (target.kind === 'identifier') {
            this.assertIdentifierIsMutable(target, target.position)
            return
        }

        if (target.kind === 'binary' && target.operator === '.') {
            const rootIdentifier = this.extractRootIdentifier(target)
            if (!rootIdentifier) {
                throw new Error(
                    `${target.position.line}:${target.position.column}:Invalid field assignment target`,
                )
            }

            const binding = this.lookupBinding(rootIdentifier.name)
            if (!binding) {
                throw new Error(
                    `${rootIdentifier.position.line}:${rootIdentifier.position.column}:Unknown identifier '${rootIdentifier.name}'`,
                )
            }

            if (binding.semantics === 'const') {
                throw new Error(
                    `${rootIdentifier.position.line}:${rootIdentifier.position.column}:Cannot mutate field through const variable '${rootIdentifier.name}'`,
                )
            }
        }
    }

    private inferExpressionSemantics(
        value: ASTExpression,
    ): ASTVariableDeclaration['semantics'] | null {
        switch (value.kind) {
            case 'call':
                return null
            case 'identifier': {
                const binding = this.lookupBinding(value.name)
                if (!binding) {
                    throw new Error(
                        `${value.position.line}:${value.position.column}:Unknown identifier '${value.name}'`,
                    )
                }
                return binding.semantics
            }
            case 'binary': {
                if (value.operator !== '.') return null
                if (value.right.kind !== 'identifier') return null
                const objectType = this.inferExpressionType(value.left)
                if (!objectType) return null
                const fields = this.lookupDataType(objectType)
                if (!fields) return null
                const fieldInfo = fields.get(value.right.name)
                if (!fieldInfo) return null
                return fieldInfo.semantics
            }
            case 'copy':
                return null
            default:
                return null
        }
    }

    private toRuntimeSemanticsFlag(
        semantics: ASTVariableDeclaration['semantics'] | null,
    ): '__rc_ISOLATED' | '__rc_SHARED' {
        return semantics === 'ref' ? '__rc_SHARED' : '__rc_ISOLATED'
    }

    private requiresSemanticCopy(
        targetSemantics: ASTVariableDeclaration['semantics'] | null,
        valueSemantics: ASTVariableDeclaration['semantics'] | null,
    ): boolean {
        if (!targetSemantics || !valueSemantics) return false
        return (
            this.toRuntimeSemanticsFlag(targetSemantics) !==
            this.toRuntimeSemanticsFlag(valueSemantics)
        )
    }

    private validateSemanticBoundary(
        targetType: string,
        targetSemantics: ASTVariableDeclaration['semantics'] | null,
        valueSemantics: ASTVariableDeclaration['semantics'] | null,
        rewrittenValue:
            | SemanticAssignment['value']
            | SemanticVariableDeclaration['value'],
        position: { line: number; column: number },
    ): void {
        if (!this.isReferenceType(targetType)) return
        if (!this.requiresSemanticCopy(targetSemantics, valueSemantics)) return
        if (this.isCopyExpression(rewrittenValue)) return

        const suggestionExpr = this.formatCopySuggestionValue(rewrittenValue)

        throw new Error(
            `${position.line}:${position.column}:Cross-semantics assignment requires explicit copy(...). Use copy(${suggestionExpr}) to state intent.`,
        )
    }

    private formatCopySuggestionValue(
        value:
            | SemanticAssignment['value']
            | SemanticVariableDeclaration['value'],
    ): string {
        switch (value.kind) {
            case 'identifier':
                return value.name
            case 'field-access':
                return `${this.formatCopySuggestionValue(value.object)}.${value.field}`
            default:
                return 'value'
        }
    }

    private isCopyExpression(
        value:
            | SemanticAssignment['value']
            | SemanticVariableDeclaration['value'],
    ): value is SemanticCopyExpression {
        return value.kind === 'copy'
    }

    private assertIdentifierIsMutable(
        identifier: ASTIdentifier,
        position: { line: number; column: number },
    ): void {
        const binding = this.lookupBinding(identifier.name)
        if (!binding) {
            throw new Error(
                `${position.line}:${position.column}:Unknown identifier '${identifier.name}'`,
            )
        }

        if (binding.semantics === 'const') {
            throw new Error(
                `${position.line}:${position.column}:Cannot assign to const variable '${identifier.name}'`,
            )
        }
    }

    private extractRootIdentifier(expr: ASTExpression): ASTIdentifier | null {
        if (expr.kind === 'identifier') return expr
        if (expr.kind === 'binary' && expr.operator === '.') {
            return this.extractRootIdentifier(expr.left)
        }
        return null
    }

    private declareBinding(
        name: string,
        binding: {
            type: string
            semantics: ASTVariableDeclaration['semantics']
        },
        position: { line: number; column: number },
    ): void {
        if (this.bindings.has(name)) {
            throw new Error(
                `${position.line}:${position.column}:Variable '${name}' is already declared in this scope`,
            )
        }

        this.bindings.set(name, binding)
    }

    private lookupBinding(name: string): VariableBinding | undefined {
        const binding = this.bindings.get(name)
        if (binding || !this.parent) return binding
        return this.parent.lookupBinding(name)
    }

    private lookupFunctionSignature(
        signatureKey: string,
    ): FunctionSignature | undefined {
        const signature = this.functionSignatures.get(signatureKey)
        if (signature || !this.parent) return signature
        return this.parent.lookupFunctionSignature(signatureKey)
    }

    private lookupFunctionSignaturesByName(
        name: string,
        ownerType?: string,
    ): FunctionSignature[] {
        const signatures = Array.from(this.functionSignatures.values()).filter(
            (signature) =>
                signature.name === name &&
                (ownerType === undefined
                    ? signature.ownerType === undefined
                    : signature.ownerType === ownerType),
        )

        if (signatures.length > 0 || !this.parent) return signatures
        return this.parent.lookupFunctionSignaturesByName(name, ownerType)
    }
}

type VariableBinding = {
    type: string
    semantics: ASTVariableDeclaration['semantics']
    declarationPosition?: { line: number; column: number }
}

type BindingMap = Map<string, VariableBinding>

type FunctionSignature = {
    name: string
    ownerType?: string
    visibility: 'public' | 'helper'
    labels: string[]
    returnType?: string
    arity: number
    parameterTypes: string[]
}

function buildFunctionSignatureKey(
    name: string,
    labels: string[],
    ownerType?: string,
): string {
    const qualifier = ownerType ? `${ownerType}.` : ''
    return `${qualifier}${name}(${labels.join(':')})`
}

function renderFunctionSignature(
    name: string,
    labels: string[],
    ownerType?: string,
): string {
    const qualifier = ownerType ? `${ownerType}.` : ''
    if (labels.length === 0) {
        return `${qualifier}${name}()`
    }
    return `${qualifier}${name}(${labels.join(':')}:)`
}

function buildDidYouMeanSignatureHint(
    name: string,
    signatures: FunctionSignature[],
    ownerType?: string,
): string {
    if (signatures.length === 0) return ''
    const first = signatures[0]
    return ` Did you mean '${renderFunctionSignature(name, first.labels, ownerType ?? first.ownerType)}'?`
}
