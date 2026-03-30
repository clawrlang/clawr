// Lowering from AST to IR for const decl and print
import type {
    ASTModule,
    ASTPrintStatement,
    ASTStatement,
    ASTExpression,
    ASTDataDeclaration,
    ASTVariableDeclaration,
    ASTDataLiteral,
} from '../ast'
import type {
    CModule,
    CStatement,
    CExpression,
    CFunctionDeclaration,
    CStruct,
    CVariableDeclaration,
} from '.'

export class IRGenerator {
    generate(ast: ASTModule): CModule {
        // For now, only a single main function and no type definitions
        return {
            structs: [
                ...ast.body
                    .filter(
                        (stmt): stmt is ASTDataDeclaration =>
                            stmt.kind === 'data-decl',
                    )
                    .flatMap(this.lowerStruct.bind(this)),
            ],
            variables: [
                ...ast.body
                    .filter(
                        (stmt): stmt is ASTDataDeclaration =>
                            stmt.kind === 'data-decl',
                    )
                    .map(this.lowerStructTypeInfo.bind(this)),
            ],
            functions: [this.lowerMainFunction(ast.body)],
        }
    }

    private lowerMainFunction(body: ASTModule['body']): CFunctionDeclaration {
        return {
            kind: 'function',
            name: 'main',
            returnType: 'int',
            parameters: [],
            body: [
                ...body
                    .filter(
                        (stmt): stmt is ASTStatement =>
                            stmt.kind !== 'data-decl',
                    )
                    .flatMap(this.lowerStatement.bind(this)),
                // Always return 0 at end of main
                {
                    kind: 'function-call',
                    name: 'return',
                    arguments: [{ kind: 'var-ref', name: '0' }],
                },
            ],
        }
    }

    private lowerStruct(stmt: ASTDataDeclaration): CStruct[] {
        const fields = stmt.fields.map((f) => ({
            name: f.name,
            type: f.type === 'truthvalue' ? 'truthvalue_t' : 'Integer*',
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
        stmt: ASTDataDeclaration,
    ): CVariableDeclaration {
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
                        },
                    },
                },
            },
            modifiers: ['static', 'const'],
        }
    }

    private lowerStatement(stmt: ASTStatement): CStatement[] {
        switch (stmt.kind) {
            case 'var-decl':
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
                                { kind: 'var-ref', name: stmt.name },
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
                    ]
                } else {
                    return [
                        {
                            kind: 'var-decl',
                            type: this.lowerType(stmt),
                            name: stmt.name,
                            value: this.lowerValue(stmt.value),
                        },
                    ]
                }
            case 'print':
                return this.lowerPrint(stmt)
            case 'assign':
                if (stmt.target.kind !== 'field-access') {
                    throw new Error(
                        'Only field assignments are supported for now',
                    )
                }
                return [
                    {
                        kind: 'assign',
                        target: {
                            kind: 'field-reference',
                            object: this.lowerValue(stmt.target.object as any),
                            field: stmt.target.field,
                            deref: true,
                        },
                        value: this.lowerValue(stmt.value as any),
                    },
                ]
            default:
                throw new Error(
                    `Unknown AST statement kind ${(stmt as any).kind}`,
                )
        }
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
        val: Exclude<ASTExpression, ASTDataLiteral>,
    ): CExpression {
        switch (val.kind) {
            case 'integer':
                return {
                    kind: 'function-call',
                    name: 'Integer¸withDigits',
                    arguments: [
                        {
                            kind: 'function-call',
                            name: 'Array¸new',
                            arguments: [
                                { kind: 'raw-expression', expression: '1' },
                                {
                                    kind: 'raw-expression',
                                    expression: val.value.toString(),
                                },
                            ],
                        },
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

    private lowerPrint(print: ASTPrintStatement): CStatement[] {
        switch (print.value.kind) {
            case 'integer':
                return [
                    {
                        kind: 'var-decl',
                        name: 'temp0',
                        type: 'Integer*',
                        value: this.lowerValue(print.value),
                    },
                    {
                        kind: 'var-decl',
                        name: 'temp1',
                        type: 'String*',
                        value: {
                            kind: 'function-call',
                            name: 'Integer·toStringRC',
                            arguments: [{ kind: 'var-ref', name: 'temp0' }],
                        },
                    },
                    {
                        kind: 'function-call',
                        name: 'printf',
                        arguments: [
                            { kind: 'string', value: '%s\\n' },
                            { kind: 'var-ref', name: 'temp1' },
                        ],
                    },
                    {
                        kind: 'function-call',
                        name: 'releaseRC',
                        arguments: [{ kind: 'var-ref', name: 'temp0' }],
                    },
                    {
                        kind: 'function-call',
                        name: 'releaseRC',
                        arguments: [{ kind: 'var-ref', name: 'temp1' }],
                    },
                ]
            case 'truthvalue': {
                const map = { false: -1, ambiguous: 0, true: 1 }
                return [
                    {
                        kind: 'function-call',
                        name: 'printf',
                        arguments: [
                            { kind: 'string', value: '%s\\n' },
                            {
                                kind: 'function-call',
                                name: 'truthvalue·toCString',
                                arguments: [
                                    {
                                        kind: 'var-ref',
                                        name: `c_${print.value.value}`,
                                    },
                                ],
                            },
                        ],
                    },
                ]
            }
            case 'identifier':
                // Assume variable is truthvalue
                return [
                    {
                        kind: 'function-call',
                        name: 'printf',
                        arguments: [
                            { kind: 'string', value: '%s\\n' },
                            {
                                kind: 'function-call',
                                name: 'truthvalue·toCString',
                                arguments: [
                                    { kind: 'var-ref', name: print.value.name },
                                ],
                            },
                        ],
                    },
                ]
            default:
                throw new Error('Unknown print value kind')
        }
    }

    private lowerType(stmt: ASTVariableDeclaration): string {
        switch (stmt.valueSet.type) {
            case 'truthvalue':
                return 'truthvalue_t'
            case 'integer':
                return 'Integer*'
            default:
                return `${stmt.valueSet.type}*`
        }
    }
}
