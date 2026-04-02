// Lowering from analyzed semantic AST to IR.
import type {
    SemanticExpression,
    SemanticFunction,
    SemanticModule,
    SemanticOwnershipEffects,
    SemanticAssignment,
    SemanticFieldAccess,
    SemanticPrintStatement,
    SemanticStatement,
    SemanticVariableDeclaration,
} from '../semantic-analyzer'
import type { CModule, CStatement, CFunctionDeclaration } from '.'
import {
    lowerStruct,
    lowerStructHooks,
    lowerStructTypeInfo,
    lowerType,
} from './lowering-types'
import {
    lowerOwnedValue,
    lowerStructLiteralFields,
    lowerValue,
} from './lowering-values'

interface LoweringContext {
    releaseAtExit: Set<string>
    tempCounter: number
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
        { kind: 'data-literal' }
    >
}

type LowerableAssignment = SemanticAssignment & {
    value: Exclude<SemanticAssignment['value'], { kind: 'data-literal' }>
}

type IdentifierAssignment = LowerableAssignment & {
    target: Extract<SemanticAssignment['target'], { kind: 'identifier' }>
}

type FieldAccessAssignment = LowerableAssignment & {
    target: SemanticFieldAccess
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

        return {
            structs: ast.types.flatMap((stmt) => lowerStruct(stmt)),
            variables: ast.types.map((stmt) => lowerStructTypeInfo(stmt)),
            functions: [
                ...ast.functions.map((fn) => this.lowerFunction(fn)),
                ...dataHookFunctions,
            ],
        }
    }

    private lowerFunction(fn: SemanticFunction): CFunctionDeclaration {
        const context: LoweringContext = {
            releaseAtExit: new Set(),
            tempCounter: 0,
        }

        return {
            kind: 'function',
            name: fn.name,
            returnType: 'int',
            parameters: [],
            body: [
                ...fn.body.flatMap((stmt) =>
                    this.lowerStatement(stmt, context),
                ),
                ...this.lowerReleaseAtExit(context),
                {
                    kind: 'function-call',
                    name: 'return',
                    arguments: [{ kind: 'var-ref', name: '0' }],
                },
            ],
        }
    }

    private lowerStatement(
        stmt: SemanticStatement,
        context: LoweringContext,
    ): CStatement[] {
        switch (stmt.kind) {
            case 'var-decl':
                if (stmt.ownership.releaseAtScopeExit)
                    context.releaseAtExit.add(stmt.name)
                return this.lowerVariableDeclaration(stmt)
            case 'print':
                return this.lowerPrint(stmt, context)
            case 'assign':
                return this.lowerAssignment(stmt)
            default:
                throw new Error(
                    `Unknown AST statement kind ${(stmt as any).kind}`,
                )
        }
    }

    private lowerVariableDeclaration(
        stmt: SemanticVariableDeclaration,
    ): CStatement[] {
        if (this.isDataLiteralVariableDeclaration(stmt)) {
            return this.lowerDataLiteralVariableDeclaration(stmt)
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
        return stmt.value.kind !== 'data-literal'
    }

    private lowerDataLiteralVariableDeclaration(
        stmt: DataLiteralVariableDeclaration,
    ): CStatement[] {
        const structTypeName = stmt.valueSet.type
        const structFields = lowerStructLiteralFields(
            this.module,
            structTypeName,
            stmt.value.fields,
        )

        return [
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
            ...this.lowerOwnershipPrefix(stmt.ownership),
        ]
    }

    private lowerAssignment(stmt: SemanticAssignment): CStatement[] {
        if (stmt.value.kind === 'data-literal') {
            throw new Error('Data-literal assignment is unsupported for now')
        }

        if (this.isLowerableAssignment(stmt)) {
            return this.lowerNonDataLiteralAssignment(stmt)
        }

        throw new Error('Unsupported assignment value kind')
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
                    { kind: 'var-ref', name: tempString },
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

    private isLowerablePrintStatement(
        print: SemanticPrintStatement,
    ): print is LowerablePrintStatement {
        return print.value.kind !== 'data-literal'
    }
}
