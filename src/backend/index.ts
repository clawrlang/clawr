import * as cir from '../cir'

function lower(cir: cir.Cir): string {
    return `#include <stdio.h>
        int main() {
            ${cir.$main ? cir.$main.map(lowerStmt).join('\n') : ''}
            return 0;
        }
        `
}

function lowerStmt(stmt: cir.Statement): string {
    switch (stmt.type) {
        case 'CALL_FUNC': {
            return `${stmt.signature.baseName}(${stmt.arguments.map(lowerExpr).join(', ')});`
        }
        default: {
            throw new Error(`Unknown statement type: ${(stmt as any).type}`)
        }
    }
}

function lowerExpr(expr: cir.Expression): string {
    switch (expr.type) {
        case 'STRING_LITERAL': {
            return `"${expr.value}"`
        }
        case 'INTEGER_LITERAL': {
            return expr.value
        }
        default: {
            throw new Error(`Unknown expression type: ${(expr as any).type}`)
        }
    }
}

export default {
    lower,
}
