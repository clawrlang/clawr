import * as cir from '../cir'

export function lower(cir: cir.ClawrModule): string {
    const variableDecls = cir.declarations?.filter(
        (decl) => decl.kind === 'VARIABLE_DECL',
    ) as cir.VariableDeclaration[]
    return `#include <stdio.h>
        #include "runtime.h"
        ${cir.declarations ? cir.declarations.map(lowerDecl).join('\n') : ''}
        ${variableDecls?.length ? lowerInit(variableDecls) : ''}
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
            } ${decl.name}ˇfields;

            typedef struct {
                __rc_header header;
                ${decl.name}ˇfields fields;
            } ${decl.name};

            static const __type_info ${decl.name}ˇtype = {
                .data_type = { .size = sizeof(${decl.name}) }
            };
            `
        }
        case 'VARIABLE_DECL': {
            return `${lowerType(decl.type)} ${decl.name};`
        }
        default: {
            throw new Error(`Unknown declaration kind: ${(decl as any).kind}`)
        }
    }
}

function lowerInit(declarations: cir.VariableDeclaration[]): string {
    return `__attribute__((constructor)) void init() {
        ${declarations.map(lowerInitStmt).join('\n')}
    }`
}

function lowerType(type: string): string {
    switch (type) {
        case 'integer':
            return 'int64_t'
        case 'truthvalue':
            return 'truthvalue_t'
        default:
            return `${type}*`
    }
}

export function lowerStmt(stmt: cir.Statement): string {
    switch (stmt.kind) {
        case 'CALL_FUNC': {
            const name = lowerCallFuncName(stmt)
            return `${name}(${stmt.arguments.map(lowerExpr).join(', ')});`
        }
        case 'VARIABLE_DECL': {
            if (stmt.initialValue.kind === 'ALLOCATE')
                return `${stmt.initialValue.type}* ${lowerInitStmt(stmt)};`
            else
                return `${lowerType(stmt.type)} ${stmt.name} = ${lowerExpr(stmt.initialValue)};`
        }
        case 'ASSIGN': {
            return `${lowerExpr(stmt.target)} = ${lowerExpr(stmt.value)};`
        }
        case 'ENSURE_UNIQUE': {
            return `mutateRC(${lowerExpr(stmt.object)});`
        }
        case 'RELEASE': {
            return `releaseRC(${lowerExpr(stmt.object)});`
        }
        default: {
            throw new Error(`Unknown statement kind: ${(stmt as any).kind}`)
        }
    }
}

export function lowerInitStmt(stmt: cir.Statement): string {
    switch (stmt.kind) {
        case 'VARIABLE_DECL': {
            if (stmt.initialValue.kind === 'ALLOCATE')
                return `
                    ${stmt.name} = allocRC(${stmt.initialValue.type}, ${stmt.initialValue.semantics === 'COW' ? '__rc_ISOLATED' : '__rc_SHARED'});
                    memcpy(((__rc_header*)${stmt.name}) + 1, &(${stmt.initialValue.type}ˇfields) {
                        ${stmt.initialValue.fields.map((field) => `.${field.name} = ${lowerExpr(field.value)}`).join(', ')}
                    }, sizeof(${stmt.initialValue.type}ˇfields));
                    `
            else return `${stmt.name} = ${lowerExpr(stmt.initialValue)};`
        }
        default: {
            return lowerStmt(stmt)
        }
    }
}

export function lowerExpr(expr: cir.Expression): string {
    switch (expr.kind) {
        case 'RETAIN': {
            return `retainRC(${lowerExpr(expr.object)})`
        }
        case 'STRING_LITERAL': {
            return `"${expr.value}"`
        }
        case 'INTEGER_LITERAL': {
            return expr.value
        }
        case 'TRUTHVALUE_LITERAL':
            return lowerTruthvalueLiteral(expr)
        case 'CALL_FUNC': {
            const name = lowerCallFuncName(expr)
            return `${name}(${expr.arguments.map(lowerExpr).join(', ')})`
        }
        case 'VARIABLE_REF': {
            return expr.name
        }
        case 'FIELD_REF': {
            return `${lowerExpr(expr.object)}->fields.${expr.field}`
        }
        default: {
            throw new Error(`Unknown expression kind: ${(expr as any).kind}`)
        }
    }
}

function lowerCallFuncName(
    signature: (cir.Expression | cir.Statement) & { kind: 'CALL_FUNC' },
): string {
    return `${signature.signature.baseName}${signature.signature.parameters
        .filter((param) => param.label)
        .map((param) => `_${param.label}`)
        .join('')}`
}

export function lowerTruthvalueLiteral(
    expr: Extract<cir.Expression, { kind: 'TRUTHVALUE_LITERAL' }>,
): string {
    return `c_${expr.value}`
}
