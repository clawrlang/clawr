// Lowering from analyzed semantic AST to IR.
import type {
    SemanticDataDeclaration,
    SemanticExpression,
    SemanticFieldAccess,
    SemanticFunction,
    SemanticModule,
    SemanticOwnershipEffects,
    SemanticPrintStatement,
    SemanticStatement,
    SemanticVariableDeclaration,
} from '../semantic-analyzer'
import type { ASTDataLiteral } from '../ast'
import type {
    CModule,
    CStatement,
    CExpression,
    CFunctionDeclaration,
    CStruct,
    CVariableDeclaration,
} from '.'

interface LoweringContext {
    releaseAtExit: Set<string>
    tempCounter: number
}

export class IRGenerator {
    generate(ast: SemanticModule): CModule {
        const dataHookFunctions = ast.types.flatMap((stmt) =>
            this.lowerStructHooks(stmt),
        )

        return {
            structs: ast.types.flatMap(this.lowerStruct.bind(this)),
            variables: ast.types.map(this.lowerStructTypeInfo.bind(this)),
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

    private lowerStruct(stmt: SemanticDataDeclaration): CStruct[] {
        const fields = stmt.fields.map((f) => ({
            name: f.name,
            type: this.lowerValueSetType(f.type),
        }))
        return [
            {
                kind: 'struct',
                name: stmt.name,
                fields: [{ name: 'header', type: '__rc_header' }, ...fields],
            },
            {
                kind: 'struct',
                name: `${stmt.name}ˇfields`,
                fields,
            },
        ]
    }

    private lowerStructTypeInfo(
        stmt: SemanticDataDeclaration,
    ): CVariableDeclaration {
        const hookNames = this.structHookNames(stmt.name)

        return {
            kind: 'var-decl',
            type: '__type_info',
            name: `${stmt.name}ˇtype`,
            value: {
                kind: 'struct-init',
                fields: {
                    data_type: {
                        kind: 'struct-init',
                        fields: {
                            size: {
                                kind: 'raw-expression',
                                expression: `sizeof(${stmt.name})`,
                            },
                            retain_nested_fields: {
                                kind: 'raw-expression',
                                expression: hookNames.retain,
                            },
                            release_nested_fields: {
                                kind: 'raw-expression',
                                expression: hookNames.release,
                            },
                        },
                    },
                },
            },
            modifiers: ['static', 'const'],
        }
    }

    private structHookNames(typeName: string): {
        retain: string
        release: string
    } {
        return {
            retain: `${typeName}ˇretainNestedFields`,
            release: `${typeName}ˇreleaseNestedFields`,
        }
    }

    private lowerStructHooks(
        stmt: SemanticDataDeclaration,
    ): CFunctionDeclaration[] {
        const rcFields = stmt.fields.filter((f) =>
            this.isReferenceCountedValueSetType(f.type),
        )
        const hooks = this.structHookNames(stmt.name)
        const selfExpr: CExpression = {
            kind: 'raw-expression',
            expression: `(${stmt.name}*)self`,
        }

        return [
            {
                kind: 'function',
                name: hooks.retain,
                returnType: 'void',
                parameters: [{ name: 'self', type: 'void*' }],
                body: rcFields.map((field) => ({
                    kind: 'function-call',
                    name: 'retainRC',
                    arguments: [
                        {
                            kind: 'field-reference',
                            object: selfExpr,
                            field: field.name,
                            deref: true,
                        },
                    ],
                })),
            },
            {
                kind: 'function',
                name: hooks.release,
                returnType: 'void',
                parameters: [{ name: 'self', type: 'void*' }],
                body: rcFields.map((field) => ({
                    kind: 'function-call',
                    name: 'releaseRC',
                    arguments: [
                        {
                            kind: 'field-reference',
                            object: selfExpr,
                            field: field.name,
                            deref: true,
                        },
                    ],
                })),
            },
        ]
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
                            type: this.lowerType(stmt),
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
                                    expression: `&(${stmt.valueSet.type}ˇfields){ ${this.lowerStructLiteralFields(stmt.value.fields)} }`,
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
                            type: this.lowerType(stmt),
                            name: stmt.name,
                            value: this.lowerValue(stmt.value),
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
                            value: this.lowerValue(stmt.value),
                        },
                    ]
                }

                if (stmt.target.kind !== 'field-access')
                    throw new Error('Unsupported assignment target kind')

                return [
                    ...this.lowerOwnershipPrefix(stmt.ownership),
                    {
                        kind: 'assign',
                        target: this.lowerValue(stmt.target),
                        value: this.lowerValue(stmt.value),
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
                    arguments: [this.lowerValue(expr)],
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
                    arguments: [this.lowerValue(expr)],
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
                    arguments: [this.lowerValue(expr)],
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

    private lowerStructLiteralFields(fields: ASTDataLiteral['fields']): string {
        return Object.entries(fields)
            .map(([k, v]) => {
                switch (v.kind) {
                    case 'truthvalue':
                        return `.${k} = c_${v.value}`
                    default:
                        throw new Error(
                            'Only truthvalue literals are supported in struct literals for now',
                        )
                }
            })
            .join(', ')
    }

    private lowerValue(
        val: Exclude<SemanticExpression, ASTDataLiteral>,
    ): CExpression {
        switch (val.kind) {
            case 'integer':
                return {
                    kind: 'function-call',
                    name: 'Integer¸fromCString',
                    arguments: [
                        { kind: 'string', value: val.value.toString() },
                    ],
                }
            case 'truthvalue':
                return { kind: 'var-ref', name: `c_${val.value}` }
            case 'identifier':
                return { kind: 'var-ref', name: val.name }
            case 'field-access':
                return {
                    kind: 'field-reference',
                    object: this.lowerValue(val.object as any), // TODO: need to fix types here
                    field: val.field,
                    deref: true,
                }
            default:
                throw new Error(`Unknown AST value kind ${(val as any).kind}`)
        }
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
                            arguments: [this.lowerValue(print.value)],
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
            case 'truthvalue': {
                return [
                    {
                        kind: 'function-call',
                        name: 'printf',
                        arguments: [
                            { kind: 'string', value: '%s\\n' },
                            {
                                kind: 'function-call',
                                name: 'truthvalue·toCString',
                                arguments: [this.lowerValue(print.value)],
                            },
                        ],
                    },
                ]
            }
            default:
                throw new Error(
                    `Unsupported print dispatch type '${print.dispatchType}'`,
                )
        }
    }

    private lowerType(stmt: SemanticVariableDeclaration): string {
        return this.lowerValueSetType(stmt.valueSet.type)
    }

    private lowerValueSetType(type: string): string {
        switch (type) {
            case 'truthvalue':
                return 'truthvalue_t'
            case 'integer':
                return 'Integer*'
            default:
                return `${type}*`
        }
    }

    private isReferenceCountedValueSetType(type: string): boolean {
        return type !== 'truthvalue'
    }
}
