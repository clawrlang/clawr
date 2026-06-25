import * as cir from '../cir'

export function lower(cir: cir.ClawrModule): string {
    return `#include <stdio.h>
        #include "runtime.h"
        ${cir.declarations ? cir.declarations.map(lowerDecl).join('\n') : ''}
        int main() {
            ${cir.startBlock ? cir.startBlock.map(lowerStmt).join('\n') : ''}
            return 0;
        }
        `
}

export function lowerDecl(decl: cir.Declaration): string {
    switch (decl.kind) {
        case 'DATA_DECL': {
            const fields = decl.fields
                .map((field) => `${lowerType(field.type)} ${field.name};`)
                .join('\n')
            return `typedef struct {
                ${fields}
            } ${decl.name};`
        }
        case 'VARIABLE_DECL': {
            return `${lowerType(decl.type)} ${decl.name} = ${lowerExpr(decl.initialValue)};`
        }
        default: {
            throw new Error(`Unknown declaration kind: ${(decl as any).kind}`)
        }
    }
}

function lowerType(type: string): string {
    switch (type) {
        case 'integer':
            return 'int64_t'
        case 'truthvalue':
            return 'truthvalue_t'
        default:
            return type // For user-defined types, we assume they are already valid C types
    }
}

export function lowerStmt(stmt: cir.Statement): string {
    switch (stmt.kind) {
        case 'CALL_FUNC': {
            return `${stmt.signature.baseName}(${stmt.arguments.map(lowerExpr).join(', ')});`
        }
        case 'VARIABLE_DECL': {
            return lowerDecl(stmt)
        }
        case 'ASSIGN': {
            return `${lowerExpr(stmt.target)} = (${lowerExpr(stmt.value)});`
        }
        default: {
            throw new Error(`Unknown statement kind: ${(stmt as any).kind}`)
        }
    }
}

export function lowerExpr(expr: cir.Expression): string {
    switch (expr.kind) {
        case 'STRING_LITERAL': {
            return `"${expr.value}"`
        }
        case 'INTEGER_LITERAL': {
            return expr.value
        }
        case 'TRUTHVALUE_LITERAL':
            return lowerTruthvalueLiteral(expr)
        case 'CALL_FUNC': {
            return `${expr.signature.baseName}(${expr.arguments.map(lowerExpr).join(', ')})`
        }
        case 'VARIABLE_REF': {
            return expr.name
        }
        case 'DATA_LITERAL': {
            const fields = expr.fields
                .map((field) => `${lowerExpr(field.value)}`)
                .join(', ')
            return `{ ${fields} }`
        }
        case 'FIELD_LOOKUP': {
            return `${lowerExpr(expr.object)}.${expr.field}`
        }
        default: {
            throw new Error(`Unknown expression kind: ${(expr as any).kind}`)
        }
    }
}

export function lowerTruthvalueLiteral(
    expr: Extract<cir.Expression, { kind: 'TRUTHVALUE_LITERAL' }>,
): string {
    return `c_${expr.value}`
}
