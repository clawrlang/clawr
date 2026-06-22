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
            throw new Error(`Unsupported type: ${type}`)
    }
}

export function lowerStmt(stmt: cir.Statement): string {
    switch (stmt.kind) {
        case 'CALL_FUNC': {
            return `${stmt.signature.baseName}(${stmt.arguments.map(lowerExpr).join(', ')});`
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
