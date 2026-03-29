// Minimal C codegen for IRModule
import type {
    CExpression,
    CModule,
    CFunctionDeclaration,
    CStruct,
    CStatement,
    CVariableDeclaration,
} from '../ir/index'

export function codegenC(program: CModule): string {
    let out = '#include <stdio.h>\n#include "runtime.h"\n\n'
    // Emit type definitions
    for (const typeDef of program.structs) {
        out += emitTypeDef(typeDef) + '\n'
    }
    // Emit all functions
    for (const func of program.functions) {
        out += emitFunction(func) + '\n'
    }
    return out
}

function emitTypeDef(typeDef: CStruct): string {
    // For now, just a placeholder for struct definition
    const fields = typeDef.fields
        .map((f) => `    ${f.type} ${f.name};`)
        .join('\n')
    return `typedef struct ${typeDef.name} {\n${fields}\n} ${typeDef.name};`
}

function emitFunction(func: CFunctionDeclaration): string {
    const params = func.parameters.map((p) => `${p.type} ${p.name}`).join(', ')
    let out = `${func.returnType} ${func.name}(${params}) {\n`
    for (const stmt of func.body) {
        out += emitStatement(stmt) + '\n'
    }
    out += '}\n'
    return out
}

function emitStatement(stmt: CStatement): string {
    switch (stmt.kind) {
        case 'var-decl':
            return emitConstDecl(stmt)
        case 'function-call':
            if (stmt.name === 'return' && stmt.arguments.length === 1) {
                return `    return ${emitExpression(stmt.arguments[0])};`
            }
            return (
                `    ${stmt.name}(` +
                stmt.arguments.map(emitExpression).join(', ') +
                ');'
            )
        case 'assign':
            return `    ${emitExpression(stmt.target)} = ${emitExpression(stmt.value)};`
        default:
            throw new Error(`Unknown statement kind: ${(stmt as any).kind}`)
    }
}

function emitConstDecl(decl: CVariableDeclaration): string {
    if (decl.value.kind === 'var-ref') {
        return `    const ${decl.type} ${decl.name} = ${decl.value.name};`
    }
    throw new Error('Unknown const value kind')
}

function emitExpression(
    value: CExpression,
    index?: number,
    array?: CExpression[],
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
