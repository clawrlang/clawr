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

    // Forward declarations let function-pointer fields reference types declared later.
    for (const typeDef of program.structs) {
        out += `typedef struct ${typeDef.name} ${typeDef.name};\n`
    }
    out += '\n'

    for (const typeDef of program.structs) {
        out += emitTypeDef(typeDef) + '\n'
    }

    for (const func of program.functions) {
        out += emitFunctionPrototype(func) + '\n'
    }
    out += '\n'

    for (const globalVar of program.variables) {
        if (globalVar.modifiers)
            out += `${globalVar.modifiers.join(' ')} ${globalVar.type} ${globalVar.name} = ${emitExpression(globalVar.value)};\n`
        else
            out += `${globalVar.type} ${globalVar.name} = ${emitExpression(globalVar.value)};\n`
    }

    for (const func of program.functions) {
        out += emitFunction(func) + '\n'
    }
    return out
}

function emitTypeDef(typeDef: CStruct): string {
    // For now, just a placeholder for struct definition
    const fields = typeDef.fields
        .map((f) => {
            const functionPointerMatch = f.type.match(/^(.*)\(\*\)\((.*)\)$/)
            if (functionPointerMatch) {
                const [, returnType, parameterTypes] = functionPointerMatch
                return `    ${returnType}(*${f.name})(${parameterTypes});`
            }
            return `    ${f.type} ${f.name};`
        })
        .join('\n')
    return `typedef struct ${typeDef.name} {\n${fields}\n} ${typeDef.name};`
}

function emitFunctionPrototype(func: CFunctionDeclaration): string {
    const params = func.parameters.map((p) => `${p.type} ${p.name}`).join(', ')
    return `${func.returnType} ${func.name}(${params});`
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
            return emitVarDecl(stmt)
        case 'return':
            return `    return ${emitExpression(stmt.value)};`
        case 'if': {
            let out = `    if (${emitExpression(stmt.condition)}) {\n`
            for (const child of stmt.thenBranch) {
                out += emitStatement(child) + '\n'
            }
            out += '    }'

            if (stmt.elseBranch) {
                out += ' else {\n'
                for (const child of stmt.elseBranch) {
                    out += emitStatement(child) + '\n'
                }
                out += '    }'
            }

            return out
        }
        case 'while': {
            let out = `    while (${emitExpression(stmt.condition)}) {\n`
            for (const child of stmt.body) {
                out += emitStatement(child) + '\n'
            }
            out += '    }'
            return out
        }
        case 'break':
            return '    break;'
        case 'continue':
            return '    continue;'
        case 'function-call':
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

function emitVarDecl(decl: CVariableDeclaration): string {
    const mods = decl.modifiers ? decl.modifiers.join(' ') + ' ' : ''
    return `    ${mods}${decl.type} ${decl.name} = ${emitExpression(decl.value)};`
}

function emitExpression(
    value: CExpression,
    index?: number,
    array?: CExpression[],
): string {
    switch (value.kind) {
        case 'string':
            return `"${value.value}"`
        case 'var-ref':
            return value.name
        case 'function-call':
            // Handle virtual dispatch via runtime type info lookup.
            if (value.dispatch?.kind === 'virtual' && value.receiver) {
                const receiverExpr = emitExpression(value.receiver)
                const methodName =
                    value.dispatch.slotName ||
                    value.dispatch.methodName ||
                    'unknown'
                const baseType =
                    value.dispatch.ownerType || value.dispatch.receiverType
                const args = value.arguments.map(emitExpression).join(', ')
                if (!baseType) {
                    throw new Error(
                        'Virtual dispatch requires ownerType or receiverType metadata',
                    )
                }
                return `VTABLE(${receiverExpr}, ${baseType})->${methodName}(${args})`
            }

            // Direct dispatch: emit functionName(args)
            return (
                `${value.name}(` +
                value.arguments.map(emitExpression).join(', ') +
                ')'
            )
        case 'raw-expression':
            return value.expression
        case 'struct-init': {
            // e.g., { .field1 = value1, .field2 = value2 }
            const fields = Object.entries(value.fields)
                .map(([k, v]) => `. ${k} = ${emitExpression(v)}`)
                .join(', ')
            return `{ ${fields} }`
        }
        case 'field-reference': {
            const obj = emitExpression(value.object)
            return value.deref
                ? `${obj}->${value.field}`
                : `${obj}.${value.field}`
        }
        default:
            throw new Error(`Unknown expression kind: ${(value as any).kind}`)
    }
}
