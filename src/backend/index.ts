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
            const mangledTypeName = mangleTypeName(decl)
            const fields = decl.fields
                .map((field) => `${lowerType(field.valueSet)} ${field.name};`)
                .join('\n')
            const vtableTypedefs = (decl.dispatchTable ?? [])?.map(
                lowerMethodTypedef,
            )
            const vtableStruct = decl.dispatchTable
                ? `typedef struct {
                        ${decl.dispatchTable.map(lowerVtableSlot).join('\n')}
                    } ${mangledTypeName}ˇvtable;`
                : ''
            const vtableMethods = decl.dispatchTable
                ?.map(lowerVtableMethod)
                .join('\n')
            const typeInfo = decl.dispatchTable
                ? `.polymorphic_type = {
                        .data = { .size = sizeof(${mangledTypeName}) },
                        .vtable = &(${mangledTypeName}ˇvtable){
                            ${vtableMethods}
                        }
                    }`
                : `.data_type = { .size = sizeof(${mangledTypeName}) }`
            return `typedef struct {
                ${fields}
            } ${mangledTypeName}ˇfields;

            typedef struct {
                __rc_header header;
                ${mangledTypeName}ˇfields fields;
            } ${mangledTypeName};

            ${vtableTypedefs.join('\n')}
            ${vtableStruct}
            ${decl.methods?.map((m) => lowerMethod(m, decl)).join('\n') ?? ''}
            static const __type_info ${mangledTypeName}ˇtype = {
                ${typeInfo}
            };
            `
        }
        case 'VARIABLE_DECL':
            return `${lowerType(decl.valueSet)} ${decl.name};`

        case 'FUNCTION_DECL':
            return lowerFunction(decl, mangleName(decl))

        default:
            throw new Error(`Unknown declaration kind: ${(decl as any).kind}`)
    }
}

function lowerVtableMethod(slot: DispatchSlot) {
    if (!slot.implementedBy) throw new Error('slot not implemented')

    const slotName = getSlotFunctionName(slot.slot)
    const declaredName = getSlotFunctionName(slot.slot, slot.declaredIn)
    const implementedName = getSlotFunctionName(slot.slot, slot.implementedBy)

    return `.${slotName} = (${declaredName}ˇmethod)${implementedName},`
}

function lowerVtableSlot(slot: DispatchSlot) {
    const typeName = `${getSlotFunctionName(slot.slot, slot.declaredIn)}ˇmethod`
    const memberName = getSlotFunctionName(slot.slot)
    return `${typeName} ${memberName};`
}

function lowerMethodTypedef({ slot, declaredIn }: DispatchSlot) {
    const returnType = slot.resultValueSet
        ? lowerType(slot.resultValueSet)
        : 'void'

    const params = [
        {
            varName: 'self',
            valueSet: {
                type: 'rc-type',
                typeName: 'void',
                semantics: 'SHARED',
            } satisfies cir.ValueSet,
        },
        ...slot.parameters,
    ]

    const mangledName = getSlotFunctionName(slot, declaredIn)

    const paramDecls = params
        .map((param) => `${lowerType(param.valueSet)} ${param.varName}`)
        .join(', ')
    return `typedef ${returnType} (*${mangledName}ˇmethod)(${paramDecls});`
}

// New helper function to extract common slot name generation logic
function getSlotFunctionName(
    slot: { baseName: string; parameters: Array<{ label?: string }> },
    type?: { namespace?: string; name: string },
): string {
    const labels = slot.parameters
        .map((p) => p.label)
        .filter((l) => l) as string[]

    return mangleFunctionName({
        namespace: type?.namespace,
        typeName: type?.name,
        baseName: slot.baseName,
        labels,
    })
}

function lowerMethod(
    decl: cir.Declaration & { kind: 'FUNCTION_DECL' },
    receiverType: cir.Declaration & { kind: 'TYPE_DECL' },
): string {
    const mangledFunctionName = mangleName(decl, receiverType)
    return lowerFunction(
        {
            ...decl,
            parameters: [
                {
                    varName: 'self',
                    valueSet: {
                        type: 'rc-type',
                        namespace: receiverType.namespace,
                        typeName: receiverType.name,
                        semantics: 'SHARED',
                    },
                },
                ...decl.parameters,
            ],
        },
        mangledFunctionName,
    )
}

function lowerFunction(
    decl: cir.Declaration & { kind: 'FUNCTION_DECL' },
    mangledName: string,
) {
    const params = decl.parameters
        .map((param) => `${lowerType(param.valueSet)} ${param.varName}`)
        .join(', ')
    const returnType = decl.resultValueSet
        ? lowerType(decl.resultValueSet)
        : 'void'

    return `${returnType} ${mangledName}(${params}) {
        ${decl.body.map(lowerStmt).join('\n')}
    }`
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
        case 'CALL':
            switch (stmt.receiver?.dispatch) {
                case undefined: {
                    const args = stmt.arguments.map(lowerExpr)
                    const name = mangleFunctionName({
                        namespace: stmt.name.namespace,
                        baseName: stmt.name.baseName,
                        labels: stmt.name.labels,
                        typeName: undefined,
                    })
                    return `${name}(${args.join(', ')});`
                }
                case 'direct': {
                    const args = stmt.receiver
                        ? [
                              lowerExpr(stmt.receiver.object),
                              ...stmt.arguments.map(lowerExpr),
                          ]
                        : stmt.arguments.map(lowerExpr)
                    const name = mangleFunctionName({
                        namespace:
                            stmt.receiver?.object.valueSet.type === 'rc-type'
                                ? stmt.receiver.object.valueSet.namespace
                                : stmt.name.namespace,
                        baseName: stmt.name.baseName,
                        labels: stmt.name.labels,
                        typeName:
                            stmt.receiver?.object.valueSet.type === 'rc-type'
                                ? stmt.receiver.object.valueSet.typeName
                                : undefined,
                    })
                    return `${name}(${args.join(', ')});`
                }
                case 'inherited': {
                    const targetName = lowerExpr(stmt.receiver.object)
                    const declarationType = mangleTypeName(
                        stmt.receiver.declaredIn,
                    )
                    const methodName = mangleFunctionName({
                        baseName: stmt.name.baseName,
                        labels: stmt.name.labels,
                        namespace: undefined,
                        typeName: undefined,
                    })
                    const args = stmt.receiver
                        ? [
                              lowerExpr(stmt.receiver.object),
                              ...stmt.arguments.map(lowerExpr),
                          ]
                        : stmt.arguments.map(lowerExpr)
                    return `VTABLE(${targetName}, ${declarationType})->${methodName}(${args});`
                }
            }
        case 'VARIABLE_DECL':
            if (stmt.initialValue.kind === 'ALLOCATION')
                return `${lowerType(stmt.initialValue.valueSet)} ${lowerInitStmt(stmt)};`
            else
                return `${lowerType(stmt.valueSet)} ${stmt.name} = ${lowerExpr(stmt.initialValue)};`
        case 'ASSIGN':
            return `${lowerExpr(stmt.target)} = ${lowerExpr(stmt.value)};`
        case 'ENSURE_UNIQUE':
            return `mutateRC(${lowerExpr(stmt.object)});`
        case 'RELEASE':
            return `releaseRC(${lowerExpr(stmt.object)});`
        case 'RETURN':
            return stmt.value ? `return ${lowerExpr(stmt.value)};` : 'return;'
        default:
            throw new Error(`Unknown statement kind: ${(stmt as any).kind}`)
    }
}

export function lowerInitStmt(stmt: cir.Statement): string {
    switch (stmt.kind) {
        case 'VARIABLE_DECL':
            return `${stmt.name} = ${lowerExpr(stmt.initialValue)};`
        default:
            return lowerStmt(stmt)
    }
}

export function lowerExpr(expr: cir.Expression): string {
    switch (expr.kind) {
        case 'RETAIN':
            return `retainRC(${lowerExpr(expr.object)})`
        case 'STRING_LITERAL':
            return `"${expr.value}"`
        case 'INTEGER_LITERAL':
            return expr.value
        case 'TRUTHVALUE_LITERAL':
            return lowerTruthvalueLiteral(expr)
        case 'CALL':
            switch (expr.receiver?.dispatch) {
                case undefined: {
                    const args = expr.arguments.map(lowerExpr)
                    const name = mangleFunctionName({
                        namespace: expr.name.namespace,
                        baseName: expr.name.baseName,
                        labels: expr.name.labels,
                        typeName: undefined,
                    })
                    return `${name}(${args.join(', ')})`
                }
                case 'direct': {
                    const args = expr.receiver
                        ? [
                              lowerExpr(expr.receiver.object),
                              ...expr.arguments.map(lowerExpr),
                          ]
                        : expr.arguments.map(lowerExpr)
                    const name = mangleFunctionName({
                        namespace:
                            expr.receiver?.object.valueSet.type === 'rc-type'
                                ? expr.receiver.object.valueSet.namespace
                                : expr.name.namespace,
                        baseName: expr.name.baseName,
                        labels: expr.name.labels,
                        typeName:
                            expr.receiver?.object.valueSet.type === 'rc-type'
                                ? expr.receiver.object.valueSet.typeName
                                : undefined,
                    })
                    return `${name}(${args.join(', ')})`
                }
                case 'inherited': {
                    const targetName = lowerExpr(expr.receiver.object)
                    const declarationType = mangleTypeName(
                        expr.receiver.declaredIn,
                    )
                    const methodName = mangleFunctionName({
                        baseName: expr.name.baseName,
                        labels: expr.name.labels,
                        namespace: undefined,
                        typeName: undefined,
                    })
                    const args = expr.receiver
                        ? [
                              lowerExpr(expr.receiver.object),
                              ...expr.arguments.map(lowerExpr),
                          ]
                        : expr.arguments.map(lowerExpr)
                    return `VTABLE(${targetName}, ${declarationType})->${methodName}(${args})`
                }
            }
        case 'VARIABLE_REF':
            return expr.name
        case 'FIELD_REF':
            return `${lowerExpr(expr.object)}->fields.${expr.field}`
        case 'AS_SHARED':
            return `shareRC(${lowerExpr(expr.object)})`
        case 'ALLOCATION':
            return `allocInitRC(${expr.valueSet.typeName}, 0, ${expr.valueSet.semantics === 'ISOLATED' ? '__rc_ISOLATED' : '__rc_SHARED'},
                ${expr.fields.map((field) => `.${field.name} = ${lowerExpr(field.value)}`).join(', ')})`
        default:
            throw new Error(`Unknown expression kind: ${(expr as any).kind}`)
    }
}

export function lowerTruthvalueLiteral(
    expr: Extract<cir.Expression, { kind: 'TRUTHVALUE_LITERAL' }>,
): string {
    return `c_${expr.value}`
}

function mangleName(
    decl: cir.Declaration & { kind: 'FUNCTION_DECL' },
    receiver?: cir.Declaration & { kind: 'TYPE_DECL' },
): string {
    return mangleFunctionName({
        namespace: receiver ? receiver.namespace : decl.namespace,
        typeName: receiver ? receiver.name : undefined,
        baseName: decl.baseName,
        labels: getParameterLabels(decl.parameters),
    })
}

// New helper for parameter label extraction
function getParameterLabels(parameters: Array<{ label?: string }>): string[] {
    return parameters
        .map((p) => p.label)
        .filter((label): label is string => label !== undefined)
}

function mangleFunctionName({
    namespace,
    typeName,
    baseName,
    labels,
}: {
    namespace: string | undefined
    typeName: string | undefined
    baseName: string
    labels: string[]
}): string {
    const freeFunctionName = [baseName, ...labels].filter(Boolean).join('˛')
    if (typeName) {
        const mangledTypeName = mangleTypeName({
            namespace,
            name: typeName,
        })
        return `${mangledTypeName}·${freeFunctionName}`
    } else
        return namespace ? `${namespace}¸${freeFunctionName}` : freeFunctionName
}

function mangleTypeName({
    namespace,
    name,
}: {
    namespace?: string
    name: string
}): string {
    return namespace ? `${namespace}¸${name}` : `${name}`
}

type DispatchSlot = NonNullable<
    (cir.Declaration & {
        kind: 'TYPE_DECL'
    })['dispatchTable']
>[number]
