// Lowering from AST to IR for const decl and print
import type {
    ASTModule,
    ASTPrintStatement,
    ASTStatement,
    ASTExpression,
} from '../ast'
import type { CModule, CStatement, CExpression, CFunctionDeclaration } from '.'

export class IRGenerator {
    generate(ast: ASTModule): CModule {
        // For now, only a single main function and no type definitions
        const mainFunc: CFunctionDeclaration = {
            kind: 'function',
            name: 'main',
            returnType: 'int',
            parameters: [],
            body: [
                ...ast.body.flatMap(this.lowerStatement.bind(this)),
                // Always return 0 at end of main
                {
                    kind: 'function-call',
                    name: 'return',
                    arguments: [{ kind: 'var-ref', name: '0' }],
                },
            ],
        }
        return {
            structs: [], // Add type definitions here in the future
            variables: [], // Add global variables here in the future
            functions: [mainFunc],
        }
    }

    private lowerStatement(stmt: ASTStatement): CStatement[] {
        if (stmt.kind === 'var-decl') {
            return [
                {
                    kind: 'var-decl',
                    type:
                        stmt.valueSet.type === 'truthvalue'
                            ? 'truthvalue_t'
                            : 'Integer*', // For now, we only have truthvalue and integer variables
                    name: stmt.name,
                    value: this.lowerValue(stmt.value),
                },
            ]
        } else if (stmt.kind === 'print') {
            return this.lowerPrint(stmt)
        }
        throw new Error('Unknown AST statement kind')
    }

    private lowerValue(val: ASTExpression): CExpression {
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
            default:
                throw new Error('Unknown AST value kind')
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
}
