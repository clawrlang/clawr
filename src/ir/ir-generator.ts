// Lowering from AST to IR for const decl and print
import type {
    ASTModule,
    ASTPrintStatement,
    ASTStatement,
    ASTExpression,
} from '../ast'
import type { CModule, CStatement, CExpression } from '.'

export class IRGenerator {
    generate(ast: ASTModule): CModule {
        return {
            body: ast.body.map(this.lowerStatement.bind(this)),
        }
    }

    private lowerStatement(stmt: ASTStatement): CStatement {
        if (stmt.kind === 'var-decl') {
            return {
                kind: 'var-decl',
                type: 'truthvalue_t', // For now, we only have truthvalue variables
                name: stmt.name,
                value: this.lowerValue(stmt.value),
            }
        } else if (stmt.kind === 'print') {
            return this.lowerPrint(stmt)
        }
        throw new Error('Unknown AST statement kind')
    }

    private lowerValue(val: ASTExpression): CExpression {
        if (val.kind === 'truthvalue') {
            return { kind: 'var-ref', name: `c_${val.value}` }
        } else if (val.kind === 'identifier') {
            return { kind: 'var-ref', name: val.name }
        }
        throw new Error('Unknown AST value kind')
    }

    private lowerPrint(print: ASTPrintStatement): CStatement {
        switch (print.value.kind) {
            case 'integer':
                return {
                    kind: 'function-call',
                    name: 'printf',
                    arguments: [
                        { kind: 'string', value: '%lld\\n' },
                        { kind: 'var-ref', name: print.value.value.toString() },
                    ],
                }
            case 'truthvalue': {
                const map = { false: -1, ambiguous: 0, true: 1 }
                return {
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
                }
            }
            case 'identifier':
                // Assume variable is truthvalue
                return {
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
                }
            default:
                throw new Error('Unknown print value kind')
        }
    }
}
