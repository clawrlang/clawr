// Lowering from analyzed semantic AST to IR.
import type {
    SemanticExpression,
    SemanticFunction,
    SemanticModule,
    SemanticOwnershipEffects,
    SemanticPrintStatement,
    SemanticStatement,
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

                if (stmt.value.kind === 'data-literal') {
                    // For data literals, we need to allocate the struct and then assign the fields
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
                                        name: stmt.valueSet.type,
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
                                    expression: `&(${stmt.valueSet.type}ˇfields){ ${lowerStructLiteralFields(this.module, stmt.valueSet.type, stmt.value.fields)} }`,
                                },
                                {
                                    kind: 'raw-expression',
                                    expression: `sizeof(${stmt.valueSet.type}) - sizeof(__rc_header)`,
                                },
                            ],
                        },
                        ...this.lowerOwnershipPrefix(stmt.ownership),
                    ]
                } else {
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
            case 'print':
                return this.lowerPrint(stmt, context)
            case 'assign':
                if (stmt.value.kind === 'data-literal')
                    throw new Error(
                        'Data-literal assignment is unsupported for now',
                    )

                if (stmt.target.kind === 'identifier') {
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

                if (stmt.target.kind !== 'field-access')
                    throw new Error('Unsupported assignment target kind')

                return [
                    ...this.lowerOwnershipPrefix(stmt.ownership),
                    {
                        kind: 'assign',
                        target: lowerValue(stmt.target),
                        value: lowerOwnedValue(stmt.value, stmt.ownership),
                    },
                ]
            default:
                throw new Error(
                    `Unknown AST statement kind ${(stmt as any).kind}`,
                )
        }
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

        switch (print.dispatchType) {
            case 'integer':
                if (print.value.kind === 'integer') {
                    return [
                        {
                            kind: 'function-call',
                            name: 'printf',
                            arguments: [
                                { kind: 'string', value: '%s\\n' },
                                {
                                    kind: 'string',
                                    value: print.value.value.toString(),
                                },
                            ],
                        },
                    ]
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
            case 'truthvalue':
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
            default:
                throw new Error(
                    `Unsupported print dispatch type '${print.dispatchType}'`,
                )
        }
    }
}
