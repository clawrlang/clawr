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
            if (!('methods' in decl))
                return `typedef struct {
                        ${fields}
                    } ${mangledTypeName}ˇfields;

                    typedef struct {
                        __rc_header header;
                        ${mangledTypeName}ˇfields fields;
                    } ${mangledTypeName};
                    static const __type_info ${mangledTypeName}ˇtype = {
                        .data_type = { .size = sizeof(${mangledTypeName}) }
                    };`
            const vtableTypedefs = (decl.dispatchTable ?? [])
                ?.filter(
                    (s) =>
                        s.declaredIn.name == decl.name &&
                        s.declaredIn.namespace == decl.namespace,
                )
                .map(lowerMethodTypedef)
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
                        ${decl.base ? `.super = &${mangleTypeName({ name: decl.base.type, namespace: decl.base.namespace })}ˇtype.polymorphic_type,` : ''}
                        .vtable = &(${mangledTypeName}ˇvtable){
                            ${vtableMethods}
                        }
                    }`
                : `.data_type = { .size = sizeof(${mangledTypeName}) }`
            return `typedef struct {
                ${fields}
            } ${mangledTypeName}ˇfields;

            typedef struct {
                ${decl.base ? `${mangleTypeName({ name: decl.base.type, namespace: decl.base.namespace })} super` : '__rc_header header'};
                ${mangledTypeName}ˇfields fields;
            } ${mangledTypeName};

            ${vtableTypedefs.join('\n')}
            ${vtableStruct}
            ${decl.methods?.map((m) => lowerMethod(m, decl)).join('\n') ?? ''}
            ${decl.initializers?.map((m) => lowerInitializer(m, decl)).join('\n') ?? ''}
            static const __type_info ${mangledTypeName}ˇtype = {
                ${typeInfo}
            };
            `
        }
        case 'VARIABLE_DECL':
            return `${lowerType(decl.valueSet)} ${decl.name};`

        case 'FUNCTION_DECL':
            return lowerFunction(decl, mangleNameWithParameters(decl))

        default:
            throw new Error(`Unknown declaration kind: ${(decl as any).kind}`)
    }
}

function lowerVtableMethod({ slot, declaredIn, implementedBy }: DispatchSlot) {
    const declaredName = mangleNameWithParameters(slot, declaredIn)
    if (!implementedBy) throw new Error(`slot ${declaredName} not implemented`)

    const slotName = mangleNameWithParameters(slot)
    const implementedName = mangleNameWithParameters(slot, implementedBy)
    return `.${slotName} = (${declaredName}ˇmethod)${implementedName},`
}

function lowerVtableSlot({ slot, declaredIn }: DispatchSlot) {
    const typedef = `${mangleNameWithParameters(slot, declaredIn)}ˇmethod`
    const slotName = mangleNameWithParameters(slot)
    return `${typedef} ${slotName};`
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

    const mangledName = mangleNameWithParameters(slot, declaredIn)

    const paramDecls = params
        .map((param) => `${lowerType(param.valueSet)} ${param.varName}`)
        .join(', ')
    return `typedef ${returnType} (*${mangledName}ˇmethod)(${paramDecls});`
}

function lowerMethod(
    decl: cir.Declaration & { kind: 'FUNCTION_DECL' },
    receiverType: cir.Declaration & { kind: 'TYPE_DECL' },
): string {
    const mangledFunctionName = mangleNameWithParameters(decl, receiverType)
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

function lowerInitializer(
    decl: cir.Declaration & { kind: 'FUNCTION_DECL' },
    receiverType: cir.Declaration & { kind: 'TYPE_DECL' },
): string {
    const mangledFunctionName = mangleNameWithParameters(decl, receiverType)
    return lowerFunction(
        {
            ...decl,
            resultValueSet: {
                type: 'rc-type',
                typeName: 'void',
                semantics: 'ISOLATED',
            },
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
            body: [
                ...decl.body,
                // TODO: Can we just add `return self;` literally?
                {
                    kind: 'RETURN',
                    value: {
                        kind: 'VARIABLE_REF',
                        name: 'self',
                        valueSet: {
                            type: 'rc-type',
                            typeName: receiverType.name,
                            namespace: receiverType.namespace,
                            semantics: 'ISOLATED',
                        },
                    },
                },
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
                    const name = mangleNameWithLabels({
                        namespace: stmt.name.namespace,
                        baseName: stmt.name.baseName,
                        labels: stmt.name.labels,
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
                    const name = mangleNameWithLabels(
                        stmt.name,
                        stmt.receiver?.type,
                    )

                    return `${name}(${args.join(', ')});`
                }
                case 'inherited': {
                    const targetName = lowerExpr(stmt.receiver.object)
                    const declarationType = mangleTypeName(
                        stmt.receiver.declaredIn,
                    )
                    const slotName = mangleNameWithLabels({
                        ...stmt.name,
                        namespace: undefined,
                    })
                    const args = stmt.receiver
                        ? [
                              lowerExpr(stmt.receiver.object),
                              ...stmt.arguments.map(lowerExpr),
                          ]
                        : stmt.arguments.map(lowerExpr)
                    return `VTABLE(${targetName}, ${declarationType})->${slotName}(${args});`
                }
            }
        case 'VARIABLE_DECL':
            return `${lowerType(stmt.valueSet)} ${stmt.name} = ${lowerExpr(stmt.initialValue)};`
        case 'ASSIGN':
            if (
                stmt.target.kind === 'VARIABLE_REF' &&
                stmt.target.name === 'self'
            )
                return `memcpy(&self->fields, &(Superˇfields){
                        .field = field,
                    },
                    sizeof(Superˇfields));`
            else return `${lowerExpr(stmt.target)} = ${lowerExpr(stmt.value)};`
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
                    const name = mangleNameWithLabels(expr.name)
                    const args = expr.arguments.map(lowerExpr)
                    return `${name}(${args.join(', ')})`
                }
                case 'direct': {
                    const args = expr.receiver
                        ? [
                              lowerExpr(expr.receiver.object),
                              ...expr.arguments.map(lowerExpr),
                          ]
                        : expr.arguments.map(lowerExpr)
                    const name = mangleNameWithLabels(
                        expr.name,
                        expr.receiver.type,
                    )
                    return `${name}(${args.join(', ')})`
                }
                case 'inherited': {
                    const targetName = lowerExpr(expr.receiver.object)
                    const declarationType = mangleTypeName(
                        expr.receiver.declaredIn,
                    )
                    const slotName = mangleNameWithLabels({
                        ...expr.name,
                        namespace: undefined,
                    })
                    const args = expr.receiver
                        ? [
                              lowerExpr(expr.receiver.object),
                              ...expr.arguments.map(lowerExpr),
                          ]
                        : expr.arguments.map(lowerExpr)
                    return `VTABLE(${targetName}, ${declarationType})->${slotName}(${args})`
                }
            }
        case 'VARIABLE_REF':
            return expr.name
        case 'FIELD_REF':
            return `${lowerExpr(expr.object)}->fields.${expr.field}`
        case 'AS_SHARED':
            return `shareRC(${lowerExpr(expr.object)})`
        case 'ALLOCATION':
            const mangledTypeName = mangleTypeName({
                name: expr.valueSet.typeName,
                namespace: expr.valueSet.namespace,
            })
            if (expr.base) {
                const mangledSuperTypeName = mangleTypeName({
                    name: expr.base.type,
                    namespace: expr.base.namespace,
                })
                return `allocInitInheritedRC(${mangledTypeName}, 0, ${mangledSuperTypeName}, ${`__rc_${expr.semantics}`},
                    ${expr.fields.map((field) => `.${field.name} = ${lowerExpr(field.value)}`).join(', ')})`
            } else
                return `allocInitRC(${mangledTypeName}, 0, ${`__rc_${expr.semantics}`},
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

function mangleNameWithParameters(
    decl: {
        namespace?: string
        baseName: string
        parameters: { label?: string }[]
    },
    receiver?: { name: string; namespace?: string },
): string {
    return mangleNameWithLabels(
        { ...decl, labels: getParameterLabels(decl.parameters) },
        receiver,
    )
}

function getParameterLabels(parameters: Array<{ label?: string }>): string[] {
    return parameters
        .map((p) => p.label)
        .filter((label): label is string => label !== undefined)
}

function mangleNameWithLabels(
    decl: {
        namespace?: string
        baseName: string
        labels: string[]
    },
    receiver?: { name: string; namespace?: string },
): string {
    const freeFunctionName = [decl.baseName, ...decl.labels].join('˛')
    if (receiver) {
        const mangledTypeName = mangleTypeName(receiver)
        return `${mangledTypeName}·${freeFunctionName}`
    } else {
        return decl.namespace
            ? `${decl.namespace}¸${freeFunctionName}`
            : freeFunctionName
    }
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
    Extract<
        cir.Declaration & {
            kind: 'TYPE_DECL'
        },
        { dispatchTable?: any }
    >['dispatchTable']
>[number]
