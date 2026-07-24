import * as cir from '../cir'
import { validateCIR } from './generated/validate-cir.typia'

export function lower(cir: cir.ClawrModule): string {
    const result = validateCIR(cir)
    if (!result.success) {
        const details = result.errors
            .map((error) => `${error.path} expected ${error.expected}`)
            .join('; ')
        throw new Error(`Invalid CIR: ${details}`)
    }

    const variableDecls =
        cir.declarations?.filter((decl) => decl.kind === 'VARIABLE_DECL') ?? []
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
        case 'TYPE_DECL': {
            const fields = decl.fields
                .map((field) => `${lowerType(field.valueSet)} ${field.name};`)
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
            return `${lowerType(decl.valueSet)} ${decl.name};`
        }
        case 'FUNCTION_DECL': {
            const params = decl.parameters
                .map((param) => `${lowerType(param.valueSet)} ${param.varName}`)
                .join(', ')
            const returnType = decl.resultValueSet
                ? lowerType(decl.resultValueSet)
                : 'void'

            return `${returnType} ${mangleFunctionName({
                baseName: decl.baseName,
                labels: decl.parameters
                    .map((param) => param.label)
                    .filter((label) => label !== undefined) as string[],
            })}(${params}) {
                    ${decl.body.map(lowerStmt).join('\n')}
                }`
        }
        default: {
            throw new Error(`Unknown declaration kind: ${(decl as any).kind}`)
        }
    }
}

function lowerInit(
    declarations: Extract<cir.Declaration, { kind: 'VARIABLE_DECL' }>[],
): string {
    return `__attribute__((constructor)) void init() {
        ${declarations.map(lowerInitStmt).join('\n')}
    }`
}

function lowerType(valueSet: cir.ValueSet): string {
    switch (valueSet.type) {
        case 'integer':
            return 'int64_t'
        case 'truthvalue':
            return 'truthvalue_t'
        case 'rc-type':
            return `${valueSet.typeName}*`
        default:
            throw new Error(`Unknown value set type: ${(valueSet as any).type}`)
    }
}

export function lowerStmt(stmt: cir.Statement): string {
    switch (stmt.kind) {
        case 'EXEC': {
            const name = mangleFunctionName(stmt.name)
            return `${name}(${stmt.arguments.map(lowerExpr).join(', ')});`
        }
        case 'VARIABLE_DECL': {
            if (stmt.initialValue.kind === 'ALLOCATE')
                return `${lowerType(stmt.initialValue.valueSet)} ${lowerInitStmt(stmt)};`
            else
                return `${lowerType(stmt.valueSet)} ${stmt.name} = ${lowerExpr(stmt.initialValue)};`
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
        case 'RETURN': {
            return stmt.value ? `return ${lowerExpr(stmt.value)};` : 'return;'
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
                    ${stmt.name} = allocRC(${stmt.initialValue.valueSet.typeName}, ${stmt.initialValue.valueSet.semantics === 'ISOLATED' ? '__rc_ISOLATED' : '__rc_SHARED'});
                    memcpy(((__rc_header*)${stmt.name}) + 1, &(${stmt.initialValue.valueSet.typeName}ˇfields) {
                        ${stmt.initialValue.fields.map((field) => `.${field.name} = ${lowerExpr(field.value)}`).join(', ')}
                    }, sizeof(${stmt.initialValue.valueSet.typeName}ˇfields));
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
        case 'QUERY': {
            //            return JSON.stringify(expr)
            const name = mangleFunctionName(expr.name)
            return `${name}(${expr.arguments.map(lowerExpr).join(', ')})`
        }
        case 'VARIABLE_REF': {
            return expr.name
        }
        case 'FIELD_REF': {
            return `${lowerExpr(expr.object)}->fields.${expr.field}`
        }
        case 'AS_SHARED': {
            return `shareRC(${lowerExpr(expr.object)})`
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

function mangleFunctionName({
    baseName,
    labels,
}: {
    baseName: string
    labels: string[]
}): string {
    return [baseName, ...labels].join('˛')
}
