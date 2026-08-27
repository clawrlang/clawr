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
        case 'RC_TYPE_DECL': {
            const mangledTypeName = mangleTypeName(decl)
            const fields = decl.fields
                .map((field) => `${lowerType(field.lattice)} ${field.name};`)
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
                        ${decl.base ? `.super = &${mangleTypeName(decl.base)}ˇtype.polymorphic_type,` : ''}
                        .vtable = &(${mangledTypeName}ˇvtable){
                            ${vtableMethods}
                        }
                    }`
                : `.data_type = { .size = sizeof(${mangledTypeName}) }`
            return `typedef struct {
                ${fields}
            } ${mangledTypeName}ˇfields;

            typedef struct {
                ${decl.base ? `${mangleTypeName(decl.base)} super` : '__rc_header header'};
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
            return `${lowerType(decl.lattice)} ${decl.name};`

        case 'FUNCTION_DECL':
            return lowerFunction(decl, mangleNameWithParameters(decl))

        case 'PROTOCOL_DECL':
            return `typedef struct ${mangleTypeName(decl)}ˇwitness {
                    ${decl.slots.map(lowerAbstractSlot).join('\n')}
                } ${mangleTypeName(decl)}ˇwitness;
                __protocol_info ${mangleTypeName(decl)}ˇinfo = {
                    .name = "${mangleTypeName(decl)}"
                };`

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

function lowerAbstractSlot(slot: FunctionSignature) {
    const slotName = mangleNameWithParameters(slot)
    const params: FunctionSignature['parameters'] = [
        {
            name: 'self',
            lattice: {
                type: 'rc-type',
                name: 'void',
            },
        },
        ...slot.parameters,
    ]
    const paramDecls = params
        .map((param) => `${lowerType(param.lattice)} ${param.name}`)
        .join(', ')
    return `${slot.lattice ? lowerType(slot.lattice) : 'void'} (*${slotName})(${paramDecls});`
}

function lowerMethodTypedef({ slot, declaredIn }: DispatchSlot) {
    const returnType = slot.lattice ? lowerType(slot.lattice) : 'void'

    const params: FunctionSignature['parameters'] = [
        {
            name: 'self',
            lattice: {
                type: 'rc-type',
                name: 'void',
            },
        },
        ...slot.parameters,
    ]

    const mangledName = mangleNameWithParameters(slot, declaredIn)

    const paramDecls = params
        .map((param) => `${lowerType(param.lattice)} ${param.name}`)
        .join(', ')
    return `typedef ${returnType} (*${mangledName}ˇmethod)(${paramDecls});`
}

function lowerMethod(
    decl: cir.Declaration & { kind: 'FUNCTION_DECL' },
    receiverType: cir.Declaration & { kind: 'RC_TYPE_DECL' },
): string {
    const mangledFunctionName = mangleNameWithParameters(decl, receiverType)
    return lowerFunction(
        {
            ...decl,
            parameters: [
                {
                    name: 'self',
                    lattice: {
                        type: 'rc-type',
                        namespace: receiverType.namespace,
                        name: receiverType.name,
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
    receiverType: cir.Declaration & { kind: 'RC_TYPE_DECL' },
): string {
    const mangledFunctionName = mangleNameWithParameters(decl, receiverType)
    const lattice = {
        type: 'rc-type' as const,
        namespace: receiverType.namespace,
        name: receiverType.name,
    }
    const self = {
        kind: 'VARIABLE_REF' as const,
        name: 'self',
        value: lattice,
        lattice,
    }
    return lowerFunction(
        {
            ...decl,
            lattice: { type: 'rc-type', name: 'void', namespace: undefined },
            parameters: [self, ...decl.parameters],
            body: [...decl.body, { kind: 'RETURN', value: self }],
        },
        mangledFunctionName,
    )
}

function lowerFunction(
    decl: cir.Declaration & { kind: 'FUNCTION_DECL' },
    mangledName: string,
) {
    const params = decl.parameters
        .map((param) => `${lowerType(param.lattice)} ${param.name}`)
        .join(', ')
    const returnType = decl.lattice ? lowerType(decl.lattice) : 'void'

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

function lowerType(lattice: cir.Lattice): string {
    switch (lattice.type) {
        case 'integer':
            return 'int64_t'
        case 'truthvalue':
            return 'truthvalue_t'
        case 'rc-type':
            return `${lattice.name}*`
        default:
            throw new Error(`Unknown value set type: ${(lattice as any).type}`)
    }
}

export function lowerStmt(stmt: cir.Statement): string {
    switch (stmt.kind) {
        case 'CALL':
            return `${lowerFunctionCall(stmt)};`
        case 'VARIABLE_DECL':
            return `${lowerType(stmt.lattice)} ${stmt.name} = ${lowerExpr(stmt.initialValue)};`
        case 'ASSIGN':
            if (
                stmt.target.kind === 'VARIABLE_REF' &&
                stmt.target.name === 'self'
            )
                return `memcpy(&self->fields, &(Superˇfields){
                        .field = field,
                    },
                    sizeof(Superˇfields));`
            else
                return `${lowerStorage(stmt.target)} = ${lowerExpr(stmt.value)};`
        case 'ENSURE_UNIQUE':
            return `mutateRC(${lowerStorage(stmt.object)});`
        case 'RELEASE':
            return `releaseRC(${lowerStorage(stmt.object)});`
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
            return `retainRC(${lowerStorage(expr.object)})`
        case 'STRING_LITERAL':
            return `"${expr.value.value}"`
        case 'INTEGER_LITERAL':
            return expr.value.max
        case 'TRUTHVALUE_LITERAL':
            return lowerTruthvalueLiteral(expr)
        case 'CALL':
            return lowerFunctionCall(expr)
        case 'VARIABLE_REF':
            return expr.name
        case 'FIELD_REF':
            return `${lowerExpr(expr.object)}->fields.${expr.field}`
        case 'AS_SHARED':
            return `shareRC(${lowerExpr(expr.object)})`
        case 'ALLOCATION':
            const mangledTypeName = mangleTypeName(expr.value)
            if (expr.base) {
                const mangledSuperTypeName = mangleTypeName(expr.base)
                return `allocInitInheritedRC(${mangledTypeName}, 0, ${mangledSuperTypeName}, ${`__rc_${expr.isolationLevel}`},
                    ${expr.fields.map((field) => `.${field.name} = ${lowerExpr(field.value)}`).join(', ')})`
            } else
                return `allocInitRC(${mangledTypeName}, 0, ${`__rc_${expr.isolationLevel}`},
                    ${expr.fields.map((field) => `.${field.name} = ${lowerExpr(field.value)}`).join(', ')})`
        default:
            throw new Error(`Unknown expression kind: ${(expr as any).kind}`)
    }
}

export function lowerStorage(
    expr:
        | Omit<cir.Expression & { kind: 'VARIABLE_REF' }, 'value'>
        | Omit<cir.Expression & { kind: 'FIELD_REF' }, 'value'>,
): string {
    switch (expr.kind) {
        case 'VARIABLE_REF':
            return expr.name
        case 'FIELD_REF':
            return `${lowerExpr(expr.object)}->fields.${expr.field}`
        default:
            throw new Error(`Unknown expression kind: ${(expr as any).kind}`)
    }
}

function lowerFunctionCall(call: cir.Statement & { kind: 'CALL' }) {
    const receiver = call.receiver
    switch (receiver?.dispatch) {
        case undefined: {
            const name = mangleNameWithLabels(call.name)
            const args = call.arguments.map(lowerExpr)
            return `${name}(${args.join(', ')})`
        }
        case 'direct': {
            const args = [
                lowerStorage(receiver.object),
                ...call.arguments.map(lowerExpr),
            ]
            const name = mangleNameWithLabels(call.name, receiver.type)
            return `${name}(${args.join(', ')})`
        }
        case 'inherited': {
            const targetName = lowerStorage(receiver.object)
            const declarationType = mangleTypeName(receiver.declaredIn)
            const slotName = mangleNameWithLabels({
                ...call.name,
                namespace: undefined,
            })
            const args = [
                lowerStorage(receiver.object),
                ...call.arguments.map(lowerExpr),
            ]
            return `VTABLE(${targetName}, ${declarationType})->${slotName}(${args})`
        }
        case 'conformance-open':
        case 'conformance-closed':
        default:
            throw new Error(
                `Dispatch mode of ${receiver?.dispatch} not yet supported`,
            )
    }
}

export function lowerTruthvalueLiteral(
    expr: Extract<cir.Expression, { kind: 'TRUTHVALUE_LITERAL' }>,
): string {
    return `c_${expr.value.values[0]}`
}

function mangleNameWithParameters(
    decl: FunctionSignature | (FunctionSignature & { namespace?: string }),
    receiver?: { name: string; namespace?: string },
): string {
    return mangleNameWithLabels(decl, receiver)
}

type FunctionSignature = {
    baseName: string
    labels: string[]
    parameters: {
        name: string
        lattice: cir.Lattice
    }[]
    lattice?: cir.Lattice
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
            kind: 'RC_TYPE_DECL'
        },
        { dispatchTable?: any }
    >['dispatchTable']
>[number]
