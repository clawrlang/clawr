// Minimal C codegen for IRModule
import type { CExpression, CModule, CVariableDeclaration } from '../ir/index'

export function codegenC(module: CModule): string {
    let out = '#include <stdio.h>\n#include "runtime.h"\n\nint main() {\n'
    for (const stmt of module.body) {
        switch (stmt.kind) {
            case 'var-decl':
                out += emitConstDecl(stmt) + '\n'
                break
            case 'function-call':
                out +=
                    `    ${stmt.name}(` +
                    stmt.arguments.map(emitExpression).join(', ') +
                    ');\n'
                break
            default:
                throw new Error(`Unknown statement kind: ${(stmt as any).kind}`)
        }
    }
    out += '    return 0;\n}\n'
    return out
}

function emitConstDecl(decl: CVariableDeclaration): string {
    if (decl.value.kind === 'var-ref') {
        return `    const ${decl.type} ${decl.name} = ${decl.value.name};`
    }
    throw new Error('Unknown const value kind')
}
function emitExpression(
    value: CExpression,
    index: number,
    array: CExpression[],
): unknown {
    switch (value.kind) {
        case 'string':
            return `"${value.value}"`
        case 'var-ref':
            return value.name
        case 'function-call':
            return (
                `${value.name}(` +
                value.arguments.map(emitExpression).join(', ') +
                ')'
            )
        default:
            throw new Error(`Unknown expression kind: ${(value as any).kind}`)
    }
}
