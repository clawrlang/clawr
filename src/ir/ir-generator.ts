// Lowering from analyzed semantic AST to IR.
import type { ASTExpression } from '../ast'
import type {
    SemanticExpression,
    SemanticFunction,
    SemanticModule,
    SemanticOwnershipEffects,
    SemanticAssignment,
    SemanticArrayIndexExpression,
    SemanticFieldAccess,
    SemanticPrintStatement,
    SemanticStatement,
    SemanticVariableDeclaration,
} from '../semantic-analyzer'
import type { CExpression, CModule, CStatement, CFunctionDeclaration } from '.'
import {
    lowerStruct,
    lowerStructHooks,
    lowerStructTypeInfo,
    lowerType,
    parseArrayElementType,
    lowerValueSetType,
    lowerObjectStruct,
    lowerObjectTypeInfo,
    lowerObjectHooks,
    lowerObjectVtable,
    lowerObjectVtableInstance,
} from './lowering-types'
import {
    lowerOwnedValue,
    lowerStructFieldExpression,
    lowerStructLiteralFields,
    lowerValue,
    mangleCallableName,
} from './lowering-values'

interface LoweringContext {
    releaseAtExit: Set<string>
    tempCounter: number
    declaredReturnType?: string
    declaredReturnSemantics?: 'const' | 'ref'
    currentOwnerType?: string
}

type DataLiteralVariableDeclaration = SemanticVariableDeclaration & {
    value: Extract<
        SemanticVariableDeclaration['value'],
        { kind: 'data-literal' }
    >
}

type NonDataLiteralVariableDeclaration = SemanticVariableDeclaration & {
    value: Exclude<
        SemanticVariableDeclaration['value'],
        { kind: 'data-literal' } | { kind: 'array-literal' }
    >
}

type ArrayLiteralVariableDeclaration = SemanticVariableDeclaration & {
    value: Extract<
        SemanticVariableDeclaration['value'],
        { kind: 'array-literal' }
    >
}

type LowerableAssignment = SemanticAssignment & {
    value: Exclude<SemanticAssignment['value'], { kind: 'data-literal' }>
}

type DataLiteralAssignment = SemanticAssignment & {
    value: Extract<SemanticAssignment['value'], { kind: 'data-literal' }>
}

type IdentifierAssignment = LowerableAssignment & {
    target: Extract<SemanticAssignment['target'], { kind: 'identifier' }>
}

type FieldAccessAssignment = LowerableAssignment & {
    target: SemanticFieldAccess
}

type ArrayIndexAssignment = LowerableAssignment & {
    target: SemanticArrayIndexExpression
}

type LowerablePrintStatement = SemanticPrintStatement & {
    value: Exclude<SemanticPrintStatement['value'], { kind: 'data-literal' }>
}

export class IRGenerator {
    private module!: SemanticModule

    generate(ast: SemanticModule): CModule {
        this.module = ast
        const dataHookFunctions = ast.types.flatMap((stmt) =>
            lowerStructHooks(stmt),
        )
        const objectHookFunctions = ast.objects.flatMap((obj) =>
            lowerObjectHooks(obj, ast.objects),
        )

        // Lower object structs and vtables
        const objectStructs = ast.objects.flatMap((obj) =>
            lowerObjectStruct(obj, ast.functionSignatures, ast.objects),
        )
        const objectVtables = ast.objects
            .map((obj) =>
                lowerObjectVtable(obj, ast.functionSignatures, ast.objects),
            )
            .filter((v) => v !== null)
        const objectVtableInstances = ast.objects
            .map((obj) =>
                lowerObjectVtableInstance(
                    obj,
                    ast.functionSignatures,
                    ast.objects,
                ),
            )
            .filter((v) => v !== null)

        return {
            structs: [
                ...ast.types.flatMap((stmt) => lowerStruct(stmt)),
                ...objectVtables,
                ...objectStructs,
            ],
            variables: [
                ...ast.types.map((stmt) => lowerStructTypeInfo(stmt)),
                ...objectVtableInstances,
                ...ast.objects.map((obj) =>
                    lowerObjectTypeInfo(
                        obj,
                        ast.functionSignatures,
                        ast.objects,
                    ),
                ),
            ],
            functions: [
                ...ast.functions.map((fn) => this.lowerFunction(fn)),
                ...dataHookFunctions,
                ...objectHookFunctions,
            ],
        }
    }

    private lowerFunction(fn: SemanticFunction): CFunctionDeclaration {
        const ownerType = methodOwnerType(fn.name)
        const context: LoweringContext = {
            releaseAtExit: new Set(),
            tempCounter: 0,
            declaredReturnType: fn.returnType,
            declaredReturnSemantics: fn.returnSemantics,
            currentOwnerType: ownerType,
        }

        const isMain = fn.name === 'main'
        const returnType = isMain
            ? 'int'
            : fn.returnType
              ? lowerValueSetType(fn.returnType)
              : 'void'
        const parameters = fn.parameters.map((param) => ({
            name: param.name,
            type: lowerValueSetType(param.type),
        }))

        let cName: string
        if (isMain) {
            cName = 'main'
        } else if (ownerType) {
            const methodPart = fn.name.slice(ownerType.length + '·'.length)
            const callableParams = fn.parameters.slice(1)
            const labels = callableParams.map((p) => p.label ?? '_')
            cName = `${ownerType}·${mangleCallableName(methodPart, labels)}`
        } else {
            const labels = fn.parameters.map((p) => p.label ?? '_')
            cName = mangleCallableName(fn.name, labels)
        }

        return {
            kind: 'function',
            name: cName,
            returnType,
            parameters,
            body: [
                ...fn.body.flatMap((stmt) =>
                    this.lowerStatement(stmt, context),
                ),
                ...this.lowerReleaseAtExit(context),
                ...(returnType === 'void'
                    ? []
                    : [
                          {
                              kind: 'return' as const,
                              value: { kind: 'var-ref' as const, name: '0' },
                          },
                      ]),
            ],
        }
    }

    private lowerStatement(
        stmt: SemanticStatement,
        context: LoweringContext,
    ): CStatement[] {
        switch (stmt.kind) {
            case 'expression': {
                // Only allow call expressions as statements
                if (stmt.value.kind === 'call') {
                    const lowered = lowerValue(stmt.value)
                    if (lowered.kind === 'function-call') {
                        return [lowered]
                    }
                }
                // Ignore non-call expressions as statements (could warn or error)
                return []
            }
            case 'var-decl':
                if (stmt.ownership.releaseAtScopeExit)
                    context.releaseAtExit.add(stmt.name)
                return this.lowerVariableDeclaration(stmt)
            case 'print':
                return this.lowerPrint(stmt, context)
            case 'assign':
                return this.lowerAssignment(stmt, context)
            case 'if':
                return [this.lowerIfStatement(stmt, context)]
            case 'while':
                return [this.lowerWhileStatement(stmt, context)]
            case 'for-in':
                return this.lowerForInStatement(stmt, context)
            case 'break':
                return [{ kind: 'break' }]
            case 'continue':
                return [{ kind: 'continue' }]
            case 'return':
                return this.lowerReturnStatement(stmt, context)
            default:
                throw new Error(
                    `Unknown AST statement kind ${(stmt as any).kind}`,
                )
        }
    }

    private lowerIfStatement(
        stmt: Extract<SemanticStatement, { kind: 'if' }>,
        context: LoweringContext,
    ): Extract<CStatement, { kind: 'if' }> {
        return {
            kind: 'if',
            condition: this.lowerTruthyCondition(stmt.condition),
            thenBranch: this.lowerScopedStatements(stmt.thenBranch, context),
            elseBranch: stmt.elseBranch
                ? this.lowerScopedStatements(stmt.elseBranch, context)
                : undefined,
        }
    }

    private lowerWhileStatement(
        stmt: Extract<SemanticStatement, { kind: 'while' }>,
        context: LoweringContext,
    ): Extract<CStatement, { kind: 'while' }> {
        return {
            kind: 'while',
            condition: this.lowerTruthyCondition(stmt.condition),
            body: this.lowerScopedStatements(stmt.body, context),
        }
    }

    private lowerForInStatement(
        stmt: Extract<SemanticStatement, { kind: 'for-in' }>,
        context: LoweringContext,
    ): CStatement[] {
        if (stmt.iterable.kind === 'data-literal') {
            throw new Error('Unsupported for-in iterable kind data-literal')
        }

        const iterableName = this.nextTempName(context)
        const indexName = this.nextTempName(context)
        const elementType = lowerValueSetType(stmt.elementType)
        const iterableExpr = this.renderExpressionInline(
            lowerValue(stmt.iterable),
        )

        return [
            {
                kind: 'var-decl',
                type: 'Array*',
                name: iterableName,
                value: { kind: 'raw-expression', expression: iterableExpr },
            },
            {
                kind: 'var-decl',
                type: 'size_t',
                name: indexName,
                value: { kind: 'raw-expression', expression: '0' },
            },
            {
                kind: 'while',
                condition: {
                    kind: 'raw-expression',
                    expression: `(${indexName} < ${iterableName}->count)`,
                },
                body: [
                    {
                        kind: 'var-decl',
                        type: elementType,
                        name: stmt.loopVar,
                        value: {
                            kind: 'raw-expression',
                            expression: `ARRAY_ELEMENT_AT_CHECKED(${indexName}, ${iterableName}, ${elementType})`,
                        },
                    },
                    ...this.lowerScopedStatements(stmt.body, context),
                    {
                        kind: 'assign',
                        target: { kind: 'var-ref', name: indexName },
                        value: {
                            kind: 'raw-expression',
                            expression: `${indexName} + 1`,
                        },
                    },
                ],
            },
        ]
    }

    private lowerScopedStatements(
        statements: SemanticStatement[],
        context: LoweringContext,
    ): CStatement[] {
        const outerReleaseSet = new Set(context.releaseAtExit)
        const lowered = statements.flatMap((child) =>
            this.lowerStatement(child, context),
        )

        const localReleaseNames = [...context.releaseAtExit]
            .filter((name) => !outerReleaseSet.has(name))
            .sort()

        for (const name of localReleaseNames) {
            context.releaseAtExit.delete(name)
        }

        return [
            ...lowered,
            ...localReleaseNames.map((name) => ({
                kind: 'function-call' as const,
                name: 'releaseRC',
                arguments: [{ kind: 'var-ref' as const, name }],
            })),
        ]
    }

    private lowerTruthyCondition(condition: SemanticExpression) {
        if (condition.kind === 'data-literal') {
            throw new Error(
                'Unsupported control-flow condition kind data-literal',
            )
        }

        const lowered = lowerValue(condition)
        return {
            kind: 'raw-expression' as const,
            expression: `(${this.renderExpressionInline(lowered)} == c_true)`,
        }
    }

    private renderExpressionInline(
        expression: ReturnType<typeof lowerValue>,
    ): string {
        switch (expression.kind) {
            case 'var-ref':
                return expression.name
            case 'string':
                return `"${expression.value}"`
            case 'raw-expression':
                return expression.expression
            case 'function-call':
                return `${expression.name}(${expression.arguments.map((arg) => this.renderExpressionInline(arg as ReturnType<typeof lowerValue>)).join(', ')})`
            case 'field-reference': {
                const object = this.renderExpressionInline(
                    expression.object as ReturnType<typeof lowerValue>,
                )
                return expression.deref
                    ? `${object}->${expression.field}`
                    : `${object}.${expression.field}`
            }
            case 'struct-init': {
                const fields = Object.entries(expression.fields)
                    .map(
                        ([name, value]) =>
                            `. ${name} = ${this.renderExpressionInline(value as ReturnType<typeof lowerValue>)}`,
                    )
                    .join(', ')
                return `{ ${fields} }`
            }
            default:
                throw new Error(
                    `Unknown expression kind ${(expression as never as { kind: string }).kind}`,
                )
        }
    }

    private lowerVariableDeclaration(
        stmt: SemanticVariableDeclaration,
    ): CStatement[] {
        if (this.isDataLiteralVariableDeclaration(stmt)) {
            return this.lowerDataLiteralVariableDeclaration(stmt)
        }

        if (this.isArrayLiteralVariableDeclaration(stmt)) {
            return this.lowerArrayLiteralVariableDeclaration(stmt)
        }

        if (this.isNonDataLiteralVariableDeclaration(stmt)) {
            return this.lowerNonDataLiteralVariableDeclaration(stmt)
        }

        throw new Error('Unsupported variable declaration value kind')
    }

    private lowerNonDataLiteralVariableDeclaration(
        stmt: NonDataLiteralVariableDeclaration,
    ): CStatement[] {
        return [
            {
                kind: 'var-decl',
                type: lowerType(stmt),
                name: stmt.name,
                value: lowerOwnedValue(stmt.value, stmt.ownership),
            },
            ...this.lowerOwnershipPrefix(stmt.ownership),
        ]
    }

    private isDataLiteralVariableDeclaration(
        stmt: SemanticVariableDeclaration,
    ): stmt is DataLiteralVariableDeclaration {
        return stmt.value.kind === 'data-literal'
    }

    private isNonDataLiteralVariableDeclaration(
        stmt: SemanticVariableDeclaration,
    ): stmt is NonDataLiteralVariableDeclaration {
        return (
            stmt.value.kind !== 'data-literal' &&
            stmt.value.kind !== 'array-literal'
        )
    }

    private isArrayLiteralVariableDeclaration(
        stmt: SemanticVariableDeclaration,
    ): stmt is ArrayLiteralVariableDeclaration {
        return stmt.value.kind === 'array-literal'
    }

    private lowerArrayLiteralVariableDeclaration(
        stmt: ArrayLiteralVariableDeclaration,
    ): CStatement[] {
        const elementType = parseArrayElementType(stmt.valueSet.type)
        if (!elementType) {
            throw new Error(
                `Array literal declaration '${stmt.name}' requires array valueSet type, got '${stmt.valueSet.type}'`,
            )
        }

        const loweredElementType = lowerValueSetType(elementType)

        const statements: CStatement[] = [
            {
                kind: 'var-decl',
                type: lowerType(stmt),
                name: stmt.name,
                value: {
                    kind: 'function-call',
                    name: 'Array¸new',
                    arguments: [
                        {
                            kind: 'raw-expression',
                            expression: `${stmt.value.elements.length}`,
                        },
                        {
                            kind: 'raw-expression',
                            expression: `sizeof(${loweredElementType})`,
                        },
                    ],
                },
            },
        ]

        stmt.value.elements.forEach((element, index) => {
            if (element.kind === 'data-literal') {
                throw new Error(
                    'Array literals with data-literal elements are not supported yet',
                )
            }

            statements.push({
                kind: 'assign',
                target: {
                    kind: 'raw-expression',
                    expression: `ARRAY_ELEMENT_AT(${index}, ${stmt.name}, ${loweredElementType})`,
                },
                value: lowerValue(element),
            })
        })

        statements.push(...this.lowerOwnershipPrefix(stmt.ownership))

        return statements
    }

    private lowerDataLiteralVariableDeclaration(
        stmt: DataLiteralVariableDeclaration,
    ): CStatement[] {
        const structTypeName = stmt.valueSet.type
        const superInitializerStatements =
            this.lowerDataLiteralSuperInitializer(stmt)
        const structFields = lowerStructLiteralFields(
            this.module,
            structTypeName,
            stmt.value.fields,
        )

        const statements: CStatement[] = [
            {
                kind: 'var-decl',
                type: lowerType(stmt),
                name: stmt.name,
                value: {
                    kind: 'function-call',
                    name: 'allocRC',
                    arguments: [
                        {
                            kind: 'var-ref',
                            name: structTypeName,
                        },
                        {
                            kind: 'var-ref',
                            name:
                                stmt.semantics === 'ref'
                                    ? '__rc_SHARED'
                                    : '__rc_ISOLATED',
                        },
                    ],
                },
            },
            {
                kind: 'function-call',
                name: 'memcpy',
                arguments: [
                    {
                        kind: 'raw-expression',
                        expression: `(__rc_header*)${stmt.name} + 1`,
                    },
                    {
                        kind: 'raw-expression',
                        expression: `&(${structTypeName}ˇfields){ ${structFields} }`,
                    },
                    {
                        kind: 'raw-expression',
                        expression: `sizeof(${structTypeName}) - sizeof(__rc_header)`,
                    },
                ],
            },
            ...superInitializerStatements,
            ...this.lowerOwnershipPrefix(stmt.ownership),
        ]

        return statements
    }

    private lowerDataLiteralSuperInitializer(
        stmt: DataLiteralVariableDeclaration,
    ): CStatement[] {
        const superInitializer = stmt.value.superInitializer
        if (!superInitializer) return []

        const callee = superInitializer.callee
        if (
            callee.kind !== 'binary' ||
            callee.operator !== '.' ||
            callee.left.kind !== 'identifier' ||
            callee.left.name !== 'super' ||
            callee.right.kind !== 'identifier'
        ) {
            throw new Error(
                'Super initializer must be a direct call in the form super.name(...)',
            )
        }

        const ownerObject = this.module.objects.find(
            (objectDecl) => objectDecl.name === stmt.valueSet.type,
        )
        if (!ownerObject?.supertype) {
            throw new Error(
                `Type '${stmt.valueSet.type}' has no direct supertype for super initializer lowering`,
            )
        }

        const labels = superInitializer.arguments.map((arg) => arg.label ?? '_')
        const methodName = callee.right.name
        const signature = this.module.functionSignatures.get(
            buildFunctionSignatureKey(
                methodName,
                labels,
                ownerObject.supertype,
            ),
        )

        if (!signature || !signature.isInheritanceInitializer) {
            throw new Error(
                `No inheritance initializer '${ownerObject.supertype}.${methodName}' matches this call`,
            )
        }

        const loweredName = `${ownerObject.supertype}·${mangleCallableName(methodName, labels)}`
        const loweredArguments: CExpression[] = [
            { kind: 'var-ref', name: stmt.name },
            ...superInitializer.arguments.map((arg, index) => {
                const declaredParameterType = signature.parameterTypes[index]
                if (!declaredParameterType) {
                    throw new Error(
                        `Missing parameter type for '${ownerObject.supertype}.${methodName}' argument ${index + 1}`,
                    )
                }

                return {
                    kind: 'raw-expression' as const,
                    expression: this.lowerDataLiteralArgumentExpression(
                        arg.value,
                        declaredParameterType,
                    ),
                }
            }),
        ]

        return [
            {
                kind: 'function-call',
                name: loweredName,
                arguments: loweredArguments,
            },
        ]
    }

    private lowerDataLiteralArgumentExpression(
        expr: ASTExpression,
        declaredType: string,
    ): string {
        return lowerStructFieldExpression(this.module, expr, declaredType)
    }

    private lowerReturnStatement(
        stmt: Extract<SemanticStatement, { kind: 'return' }>,
        context: LoweringContext,
    ): CStatement[] {
        if (stmt.value === undefined) {
            return [
                {
                    kind: 'return',
                    value: { kind: 'var-ref', name: '0' },
                },
            ]
        }

        if (stmt.value.kind === 'data-literal') {
            if (!context.declaredReturnType) {
                throw new Error(
                    'Data-literal return requires a declared function return type',
                )
            }

            const tempName = this.nextTempName(context)
            const temporaryDeclaration: DataLiteralVariableDeclaration = {
                kind: 'var-decl',
                semantics:
                    context.declaredReturnSemantics === 'ref' ? 'ref' : 'const',
                name: tempName,
                valueSet: { type: context.declaredReturnType },
                value: stmt.value,
                ownership: {},
                position: stmt.position,
            }

            return [
                ...this.lowerDataLiteralVariableDeclaration(
                    temporaryDeclaration,
                ),
                {
                    kind: 'return',
                    value: { kind: 'var-ref', name: tempName },
                },
            ]
        }

        return [
            {
                kind: 'return',
                value: lowerValue(stmt.value),
            },
        ]
    }

    private lowerAssignment(
        stmt: SemanticAssignment,
        context: LoweringContext,
    ): CStatement[] {
        if (stmt.value.kind === 'data-literal') {
            return this.lowerDataLiteralAssignment(
                stmt as DataLiteralAssignment,
                context,
            )
        }

        if (this.isLowerableAssignment(stmt)) {
            return this.lowerNonDataLiteralAssignment(stmt)
        }

        throw new Error('Unsupported assignment value kind')
    }

    private lowerDataLiteralAssignment(
        stmt: DataLiteralAssignment,
        context: LoweringContext,
    ): CStatement[] {
        if (stmt.target.kind !== 'identifier' || stmt.target.name !== 'self') {
            throw new Error(
                "Data-literal assignment is currently only supported for target 'self'",
            )
        }

        const ownerType = context.currentOwnerType
        if (!ownerType) {
            throw new Error(
                "Cannot resolve owning type for data-literal assignment target 'self'",
            )
        }

        const structFields = lowerStructLiteralFields(
            this.module,
            ownerType,
            stmt.value.fields,
        )
        const superInitializerStatements =
            this.lowerDataLiteralSuperInitializer({
                kind: 'var-decl',
                semantics: 'const',
                name: 'self',
                valueSet: { type: ownerType },
                value: stmt.value,
                ownership: {},
                position: stmt.position,
            })

        return [
            {
                kind: 'function-call',
                name: 'memcpy',
                arguments: [
                    {
                        kind: 'raw-expression',
                        expression: '(__rc_header*)self + 1',
                    },
                    {
                        kind: 'raw-expression',
                        expression: `&(${ownerType}ˇfields){ ${structFields} }`,
                    },
                    {
                        kind: 'raw-expression',
                        expression: `sizeof(${ownerType}) - sizeof(__rc_header)`,
                    },
                ],
            },
            ...superInitializerStatements,
            ...this.lowerOwnershipPrefix(stmt.ownership),
        ]
    }

    private lowerNonDataLiteralAssignment(
        stmt: LowerableAssignment,
    ): CStatement[] {
        if (this.isIdentifierAssignment(stmt)) {
            return this.lowerIdentifierAssignment(stmt)
        }

        if (this.isFieldAccessAssignment(stmt)) {
            return this.lowerFieldAccessAssignment(stmt)
        }

        if (this.isArrayIndexAssignment(stmt)) {
            return this.lowerArrayIndexAssignment(stmt)
        }

        throw new Error('Unsupported assignment target kind')
    }

    private lowerIdentifierAssignment(
        stmt: IdentifierAssignment,
    ): CStatement[] {
        return [
            ...this.lowerOwnershipPrefix(stmt.ownership),
            {
                kind: 'assign',
                target: {
                    kind: 'var-ref',
                    name: stmt.target.name,
                },
                value: lowerOwnedValue(stmt.value, stmt.ownership),
            },
        ]
    }

    private lowerFieldAccessAssignment(
        stmt: FieldAccessAssignment,
    ): CStatement[] {
        return [
            ...this.lowerOwnershipPrefix(stmt.ownership),
            {
                kind: 'assign',
                target: lowerValue(stmt.target),
                value: lowerOwnedValue(stmt.value, stmt.ownership),
            },
        ]
    }

    private isIdentifierAssignment(
        stmt: LowerableAssignment,
    ): stmt is IdentifierAssignment {
        return stmt.target.kind === 'identifier'
    }

    private isFieldAccessAssignment(
        stmt: LowerableAssignment,
    ): stmt is FieldAccessAssignment {
        return stmt.target.kind === 'field-access'
    }

    private isArrayIndexAssignment(
        stmt: LowerableAssignment,
    ): stmt is ArrayIndexAssignment {
        return stmt.target.kind === 'array-index'
    }

    private lowerArrayIndexAssignment(
        stmt: ArrayIndexAssignment,
    ): CStatement[] {
        return [
            ...this.lowerOwnershipPrefix(stmt.ownership),
            {
                kind: 'assign',
                target: lowerValue(stmt.target),
                value: lowerOwnedValue(stmt.value, stmt.ownership),
            },
        ]
    }

    private isLowerableAssignment(
        stmt: SemanticAssignment,
    ): stmt is LowerableAssignment {
        return stmt.value.kind !== 'data-literal'
    }

    private lowerOwnershipPrefix(
        ownership: SemanticOwnershipEffects,
    ): CStatement[] {
        const mutates = (ownership.mutates ?? []).map(
            (expr: SemanticExpression) => {
                if (expr.kind === 'data-literal') {
                    throw new Error('Unsupported mutate ownership expression')
                }
                return {
                    kind: 'function-call' as const,
                    name: 'mutateRC',
                    arguments: [lowerValue(expr)],
                }
            },
        )

        const retains = (ownership.retains ?? []).map(
            (expr: SemanticExpression) => {
                if (expr.kind === 'data-literal') {
                    throw new Error('Unsupported retain ownership expression')
                }
                return {
                    kind: 'function-call' as const,
                    name: 'retainRC',
                    arguments: [lowerValue(expr)],
                }
            },
        )

        const releases = (ownership.releases ?? []).map(
            (expr: SemanticExpression) => {
                if (expr.kind === 'data-literal') {
                    throw new Error('Unsupported release ownership expression')
                }
                return {
                    kind: 'function-call' as const,
                    name: 'releaseRC',
                    arguments: [lowerValue(expr)],
                }
            },
        )

        return [...mutates, ...retains, ...releases]
    }

    private lowerReleaseAtExit(context: LoweringContext): CStatement[] {
        return [...context.releaseAtExit].sort().map((name) => ({
            kind: 'function-call' as const,
            name: 'releaseRC',
            arguments: [{ kind: 'var-ref' as const, name }],
        }))
    }

    private nextTempName(context: LoweringContext): string {
        const name = `tempˇ${context.tempCounter}`
        context.tempCounter += 1
        return name
    }

    private lowerPrint(
        print: SemanticPrintStatement,
        context: LoweringContext,
    ): CStatement[] {
        if (print.value.kind === 'data-literal') {
            throw new Error('Unsupported print value kind data-literal')
        }

        if (this.isLowerablePrintStatement(print)) {
            return this.lowerNonDataLiteralPrint(print, context)
        }

        throw new Error('Unsupported print value kind')
    }

    private lowerNonDataLiteralPrint(
        print: LowerablePrintStatement,
        context: LoweringContext,
    ): CStatement[] {
        switch (print.dispatchType) {
            case 'integer':
                return this.lowerIntegerPrint(print, context)
            case 'string':
                return this.lowerStringPrint(print)
            case 'truthvalue':
                return this.lowerTruthvaluePrint(print)
            default:
                throw new Error(
                    `Unsupported print dispatch type '${print.dispatchType}'`,
                )
        }
    }

    private lowerIntegerPrint(
        print: LowerablePrintStatement,
        context: LoweringContext,
    ): CStatement[] {
        if (print.value.kind === 'integer') {
            return this.lowerIntegerLiteralPrint(print.value.value)
        }

        const tempString = this.nextTempName(context)
        return [
            {
                kind: 'var-decl',
                name: tempString,
                type: 'String*',
                value: {
                    kind: 'function-call',
                    name: 'Integer·toStringRC',
                    arguments: [lowerValue(print.value)],
                },
            },
            {
                kind: 'function-call',
                name: 'printf',
                arguments: [
                    { kind: 'string', value: '%s\\n' },
                    {
                        kind: 'function-call',
                        name: 'String·toCString',
                        arguments: [{ kind: 'var-ref', name: tempString }],
                    },
                ],
            },
            {
                kind: 'function-call',
                name: 'releaseRC',
                arguments: [{ kind: 'var-ref', name: tempString }],
            },
        ]
    }

    private lowerIntegerLiteralPrint(value: bigint): CStatement[] {
        return [
            {
                kind: 'function-call',
                name: 'printf',
                arguments: [
                    { kind: 'string', value: '%s\\n' },
                    {
                        kind: 'string',
                        value: value.toString(),
                    },
                ],
            },
        ]
    }

    private lowerTruthvaluePrint(print: LowerablePrintStatement): CStatement[] {
        return [
            {
                kind: 'function-call',
                name: 'printf',
                arguments: [
                    { kind: 'string', value: '%s\\n' },
                    {
                        kind: 'function-call',
                        name: 'truthvalue·toCString',
                        arguments: [lowerValue(print.value)],
                    },
                ],
            },
        ]
    }

    private lowerStringPrint(print: LowerablePrintStatement): CStatement[] {
        if (print.value.kind === 'string') {
            return [
                {
                    kind: 'function-call',
                    name: 'printf',
                    arguments: [
                        { kind: 'string', value: '%s\\n' },
                        { kind: 'string', value: print.value.value },
                    ],
                },
            ]
        }

        return [
            {
                kind: 'function-call',
                name: 'printf',
                arguments: [
                    { kind: 'string', value: '%s\\n' },
                    {
                        kind: 'function-call',
                        name: 'String·toCString',
                        arguments: [lowerValue(print.value)],
                    },
                ],
            },
        ]
    }

    private isLowerablePrintStatement(
        print: SemanticPrintStatement,
    ): print is LowerablePrintStatement {
        return print.value.kind !== 'data-literal'
    }
}

function buildFunctionSignatureKey(
    name: string,
    labels: string[],
    ownerType?: string,
): string {
    const qualifier = ownerType ? `${ownerType}.` : ''
    return `${qualifier}${name}(${labels.join(':')})`
}

function methodOwnerType(functionName: string): string | undefined {
    const separator = functionName.indexOf('·')
    if (separator <= 0) return undefined
    return functionName.slice(0, separator)
}
