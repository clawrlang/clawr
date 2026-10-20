import * as cir from '@clawr/cir'
import CIRParser from './cir-parser.js'

// Storage references carry no type in the CIR, so remember declared variable types.
let variableTypes = new Map<string, cir.ValueSet>()
const propertyTypes = new Map<string, cir.ValueSet>()

type CallSignature = {
    parameters: cir.ValueSet[]
    returnType: cir.ValueSet | { universe: 'void' }
}
const signatures = new Map<string, CallSignature>()

// Owned `Integer*` temporaries of the statement being lowered.
let temps: { name: string; init: string }[] = []
let tempCounter = 0
// Implicit `Integer*` locals of the blocks being lowered, innermost last.
const blockLocals: string[][] = []
let currentReturnType: cir.ValueSet | { universe: 'void' } = {
    universe: 'void',
}

function hoist(init: string): string {
    const name = `tmpˇ${tempCounter++}`
    temps.push({ name, init })
    return name
}

function drainTemps(): { pre: string; post: string } {
    const drained = temps
    temps = []
    return {
        pre: drained.map((t) => `Integer* ${t.name} = ${t.init};`).join('\n'),
        post: drained.map((t) => `releaseRC(${t.name});`).join('\n'),
    }
}

function registerSignature(
    key: string,
    signature: {
        parameters: cir.ValueSet[]
        returnType: cir.ValueSet | { universe: 'void' }
    },
) {
    signatures.set(key, signature)
}

function registerSignatures(declarations: cir.Declaration[]) {
    for (const decl of declarations) {
        switch (decl.kind) {
            case 'FUNCTION_DECL':
                registerSignature(mangleNameWithLabels(decl), {
                    parameters: decl.parameters.map((p) => p.type),
                    returnType: decl.returnType,
                })
                break
            case 'INTERFACE_DECL':
                for (const method of decl.methods)
                    registerSignature(mangleNameWithLabels(method, decl), {
                        parameters: method.parameters.map((p) => p.type),
                        returnType: method.returnType,
                    })
                break
            case 'RC_TYPE_DECL':
                if (!('methods' in decl)) break
                for (const method of [
                    ...decl.methods,
                    ...(decl.initializers ?? []),
                ])
                    registerSignature(mangleNameWithLabels(method, decl), {
                        parameters: method.parameters.map((p) => p.type),
                        returnType: method.returnType,
                    })
                for (const { slot } of decl.dispatchTable ?? [])
                    registerSignature(mangleNameWithLabels(slot, decl), {
                        parameters: slot.parameters.map((p) => p.type),
                        returnType: slot.returnType,
                    })
                break
        }
    }
}

function propertyTypeOf(
    owner: cir.ValueSet,
    name: string,
): cir.ValueSet | undefined {
    return owner.universe === 'rc-type'
        ? propertyTypes.get(`${mangleTypeName(owner)}.${name}`)
        : undefined
}

function lowerPropertyValue(
    owner: cir.ValueSet,
    property: { name: string; value: cir.Expression },
): string {
    const type =
        owner.universe === 'rc-type'
            ? propertyTypes.get(`${mangleTypeName(owner)}.${property.name}`)
            : undefined
    return type
        ? lowerConverted(property.value, type)
        : lowerExpr(property.value)
}

function targetType(
    target: Extract<cir.Statement, { kind: 'ASSIGN' }>['target'],
): cir.ValueSet | undefined {
    return target.kind === 'VARIABLE_REF'
        ? variableTypes.get(target.name)
        : undefined
}

export function lower(json: string): string {
    variableTypes = new Map()
    propertyTypes.clear()
    signatures.clear()
    temps = []
    blockLocals.length = 0
    const cir = CIRParser.parse(json)
    for (const decl of cir.declarations ?? [])
        if (decl.kind === 'RC_TYPE_DECL')
            for (const property of decl.properties)
                propertyTypes.set(
                    `${mangleTypeName(decl)}.${property.name}`,
                    property.type,
                )

    registerSignatures(cir.declarations ?? [])

    const variableDecls =
        cir.declarations?.filter((decl) => decl.kind === 'VARIABLE_DECL') ?? []
    return `#include <stdio.h>
        #include "runtime.h"
        ${cir.declarations ? cir.declarations.map(lowerDecl).join('\n') : ''}
        ${variableDecls?.length ? lowerInit(variableDecls) : ''}
        int main() {
            ${cir.startBlock ? lowerBlock(cir.startBlock, { universe: 'void' }, []) : ''}
            return 0;
        }
        `
}

/**
 * Properties holding pointers (rc-types, boxed values and implicit `Integer*`
 * values) are owned by the entity, so copy-on-write and deallocation must
 * retain and release them.
 */
function lowerNestedHooks(
    decl: cir.Declaration & { kind: 'RC_TYPE_DECL' },
    ownedProperties: { name: string }[],
): { code: string; fields: string } {
    const base = 'base' in decl ? decl.base : undefined
    if (!ownedProperties.length && !base) return { code: '', fields: '' }
    const name = mangleTypeName(decl)
    const hook = (action: 'retain' | 'release') => {
        const baseHook = base
            ? `{ void (*h)(void *) = ${mangleTypeName(base)}ˇtype.polymorphic_type.data.${action}_nested_properties; if (h) h(self); }`
            : ''
        return `static void ${name}ˇ${action}Nested(void *self) {
            ${baseHook}
            ${ownedProperties.map((p) => `${action}RC(((${name} *)self)->properties.${p.name});`).join('\n')}
        }`
    }
    return {
        code: `${hook('retain')}\n${hook('release')}`,
        fields: `, .retain_nested_properties = ${name}ˇretainNested, .release_nested_properties = ${name}ˇreleaseNested`,
    }
}

export function lowerDecl(decl: cir.Declaration): string {
    switch (decl.kind) {
        case 'RC_TYPE_DECL': {
            const mangledTypeName = mangleTypeName(decl)
            const properties = decl.properties
                .map(
                    (property) =>
                        `${lowerType(property.type)} ${property.name};`,
                )
                .join('\n')
            const ownedProperties = decl.properties.filter((property) =>
                isPointerType(property.type),
            )
            const nestedHooks = lowerNestedHooks(decl, ownedProperties)
            if (!('methods' in decl))
                return `typedef struct {
                        ${properties}
                    } ${mangledTypeName}ˇproperties;

                    typedef struct {
                        __rc_header header;
                        ${mangledTypeName}ˇproperties properties;
                    } ${mangledTypeName};
                    ${nestedHooks.code}
                    static const __type_info ${mangledTypeName}ˇtype = {
                        .data_type = { .size = sizeof(${mangledTypeName}) ${nestedHooks.fields} }
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
                        .data = { .size = sizeof(${mangledTypeName}) ${nestedHooks.fields} },
                        ${decl.base ? `.super = &${mangleTypeName(decl.base)}ˇtype.polymorphic_type,` : ''}
                        .vtable = &(${mangledTypeName}ˇvtable){
                            ${vtableMethods}
                        }
                    }`
                : `.data_type = { .size = sizeof(${mangledTypeName}) ${nestedHooks.fields} }`
            return `typedef struct {
                ${properties}
            } ${mangledTypeName}ˇproperties;

            typedef struct {
                ${decl.base ? `${mangleTypeName(decl.base)} super` : '__rc_header header'};
                ${mangledTypeName}ˇproperties properties;
            } ${mangledTypeName};

            ${vtableTypedefs.join('\n')}
            ${vtableStruct}
            ${nestedHooks.code}
            ${decl.methods?.map((m) => lowerMethod(m, decl)).join('\n') ?? ''}
            static const __type_info ${mangledTypeName}ˇtype = {
                ${typeInfo}
            };
            ${decl.initializers?.map((m) => lowerInitializer(m, decl)).join('\n') ?? ''}
            `
        }
        case 'VARIABLE_DECL':
            variableTypes.set(decl.name, decl.type)
            return `${lowerType(decl.type)} ${decl.name};`

        case 'FUNCTION_DECL':
            return lowerFunction(decl, mangleNameWithParameters(decl))

        case 'INTERFACE_DECL':
            return `typedef struct ${mangleTypeName(decl)}ˇwitness {
                    ${decl.methods.map(lowerAbstractSlot).join('\n')}
                } ${mangleTypeName(decl)}ˇwitness;
                __interface_info ${mangleTypeName(decl)}ˇinfo = {
                    .name = "${mangleTypeName(decl)}"
                };`

        default:
            throw new Error(`Unknown declaration kind: ${(decl as any).kind}`)
    }
}

function lowerVtableMethod({ slot, declaredIn, implementation }: DispatchSlot) {
    const declaredName = mangleNameWithParameters(slot, declaredIn)
    if (!implementation) throw new Error(`slot ${declaredName} not implemented`)

    const slotName = mangleNameWithParameters(slot)
    const implementedName = mangleNameWithParameters(slot, implementation)
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
            type: {
                universe: 'rc-type',
                name: 'void',
            },
        },
        ...slot.parameters,
    ]
    const paramDecls = params
        .map((param) => `${lowerType(param.type)} ${param.name}`)
        .join(', ')
    return `${lowerType(slot.returnType)} (*${slotName})(${paramDecls});`
}

function lowerMethodTypedef({ slot, declaredIn }: DispatchSlot) {
    const returnType = lowerType(slot.returnType)

    const params: FunctionSignature['parameters'] = [
        {
            name: 'self',
            type: {
                universe: 'rc-type',
                name: 'void',
            },
        },
        ...slot.parameters,
    ]

    const mangledName = mangleNameWithParameters(slot, declaredIn)

    const paramDecls = params
        .map((param) => `${lowerType(param.type)} ${param.name}`)
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
                    type: {
                        universe: 'rc-type',
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
    const type = {
        universe: 'rc-type' as const,
        namespace: receiverType.namespace,
        name: receiverType.name,
    }
    const self = {
        kind: 'VARIABLE_REF' as const,
        name: 'self',
        value: type,
        type,
    }
    return lowerFunction(
        {
            ...decl,
            returnType: {
                universe: 'rc-type',
                name: 'void',
                namespace: undefined,
            },
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
        .map((param) => {
            return param.type.universe === 'rc-type'
                ? `void* cˇ${param.name}`
                : `${lowerType(param.type)} ${param.name}`
        })
        .join(', ')
    const returnType = lowerType(decl.returnType)

    return `${returnType} ${mangledName}(${params}) {
        ${[
            ...decl.parameters
                .filter((param) => param.type.universe === 'rc-type')
                .map(
                    (param) =>
                        `${lowerType(param.type)} ${param.name} = cˇ${param.name};\n`,
                ),
            lowerBlock(decl.body, decl.returnType, decl.parameters),
        ].join('\n')}
    }`
}

function lowerInit(
    declarations: Extract<cir.Declaration, { kind: 'VARIABLE_DECL' }>[],
): string {
    return `__attribute__((constructor)) void init() {
        ${declarations.map(lowerInitStmt).join('\n')}
    }`
}

function lowerType(valueSet: cir.ValueSet | { universe: 'void' }): string {
    switch (valueSet.universe) {
        case 'integer':
            return integerRepresentation(valueSet) === 'native'
                ? 'int64_t'
                : 'Integer*'
        case 'truthvalue':
            return valueSet.boxed ? 'TruthvalueBox*' : 'truthvalue_t'
        case 'rc-type':
            return `${valueSet.name}*`
        case 'void':
            return 'void'
        default:
            throw new Error(
                `Unknown value set universe: ${(valueSet as any).universe}`,
            )
    }
}

function isPointerType(valueSet: cir.ValueSet): boolean {
    return lowerType(valueSet).endsWith('*')
}

const NATIVE_INTEGER_LIMIT = 2n ** 63n - 1n

/**
 * Chooses the machine representation of an integer value set (ADR-016). The
 * range is symmetric because Integer digits cannot hold INT64_MIN.
 */
export function integerRepresentation(
    valueSet: cir.ValueSet & { universe: 'integer' },
): 'native' | 'big' {
    return valueSet.boxed ? 'big' : rangeRepresentation(valueSet)
}

function rangeRepresentation(
    valueSet: cir.ValueSet & { universe: 'integer' },
): 'native' | 'big' {
    const fits = (bound: string | undefined) =>
        bound !== undefined &&
        BigInt(bound) >= -NATIVE_INTEGER_LIMIT &&
        BigInt(bound) <= NATIVE_INTEGER_LIMIT
    return 'value' in valueSet
        ? fits(valueSet.value)
            ? 'native'
            : 'big'
        : fits(valueSet.min) && fits(valueSet.max)
          ? 'native'
          : 'big'
}

function isImplicitBig(valueSet: cir.ValueSet): boolean {
    return (
        valueSet.universe === 'integer' &&
        !valueSet.boxed &&
        integerRepresentation(valueSet) === 'big'
    )
}

type Representation = 'native' | 'big'

/** The representation of an implicit (backend-managed) integer, else undefined. */
function implicitRepresentation(valueSet: cir.ValueSet) {
    return valueSet.universe === 'integer' && !valueSet.boxed
        ? rangeRepresentation(valueSet)
        : undefined
}

/**
 * The type that decides how `expr` is stored. For references that is the
 * declared type, which may be wider than the (narrowed) type of the expression.
 */
function storageType(expr: cir.Expression): cir.ValueSet {
    if (expr.kind === 'VARIABLE_REF')
        return variableTypes.get(expr.name) ?? expr.type
    if (expr.kind === 'PROPERTY_REF')
        return propertyTypeOf(expr.object.type, expr.property) ?? expr.type
    return expr.type
}

/** Does evaluating `expr` produce a new `Integer*` that someone must release? */
function isOwnedBig(expr: cir.Expression): boolean {
    return (
        implicitRepresentation(storageType(expr)) === 'big' &&
        expr.kind !== 'VARIABLE_REF' &&
        expr.kind !== 'PROPERTY_REF'
    )
}

/**
 * Lowers an integer expression for temporary use in the representation `to`.
 * The result is borrowed: owned intermediates are hoisted and released after
 * the statement.
 */
function lowerBorrowed(expr: cir.Expression, to: Representation): string {
    const from = implicitRepresentation(storageType(expr))
    const lowered = lowerExpr(expr)
    if (from === undefined || from === to)
        return from === 'big' && isOwnedBig(expr) ? hoist(lowered) : lowered
    if (from === 'native') return hoist(`Integer¸fromInt64(${lowered})`)
    return `Integer·toInt64(${isOwnedBig(expr) ? hoist(lowered) : lowered})`
}

/**
 * Lowers an integer expression to a value that the receiver will own
 * (stored in a variable or property, or returned).
 */
function lowerOwned(expr: cir.Expression, to: Representation): string {
    const from = implicitRepresentation(storageType(expr))
    if (from === undefined) return lowerExpr(expr)
    if (from === 'native' && to === 'big')
        return `Integer¸fromInt64(${lowerExpr(expr)})`
    if (from === 'big' && to === 'native') return lowerBorrowed(expr, to)
    if (from === 'big')
        return isOwnedBig(expr)
            ? lowerExpr(expr)
            : `retainRC(${lowerExpr(expr)})`
    return lowerExpr(expr)
}

/** Lowers `expr` for storing in a location of type `target`. */
function lowerConverted(expr: cir.Expression, target: cir.ValueSet): string {
    const to = implicitRepresentation(target)
    return to === undefined ? lowerExpr(expr) : lowerOwned(expr, to)
}

/** Lowers a call argument for a parameter of type `parameter`. */
function lowerArgument(expr: cir.Expression, parameter?: cir.ValueSet) {
    const to = parameter && implicitRepresentation(parameter)
    return to === undefined ? lowerExpr(expr) : lowerBorrowed(expr, to)
}

function lowerBlock(
    statements: cir.Statement[],
    returnType: cir.ValueSet | { universe: 'void' },
    parameters: { name: string; type: cir.ValueSet }[],
): string {
    const savedVariables = variableTypes
    const savedReturnType = currentReturnType
    variableTypes = new Map(variableTypes)
    for (const param of parameters) variableTypes.set(param.name, param.type)
    currentReturnType = returnType
    blockLocals.push([])
    try {
        const lowered = statements.map(lowerStmt)
        const locals = blockLocals[blockLocals.length - 1]
        if (statements[statements.length - 1]?.kind !== 'RETURN')
            lowered.push(...locals.map((name) => `releaseRC(${name});`))
        return lowered.join('\n')
    } finally {
        blockLocals.pop()
        variableTypes = savedVariables
        currentReturnType = savedReturnType
    }
}

export function lowerStmt(stmt: cir.Statement): string {
    const saved = temps
    temps = []
    const code = lowerStmtCore(stmt)
    const { pre, post } = drainTemps()
    temps = saved
    return [pre, code, post].filter(Boolean).join('\n')
}

function lowerStmtCore(stmt: cir.Statement): string {
    switch (stmt.kind) {
        case 'CALL': {
            const call = lowerFunctionCall(stmt)
            const returned = signatureOf(stmt)?.returnType
            return returned &&
                implicitRepresentation(returned as cir.ValueSet) === 'big'
                ? (hoist(call), '')
                : `${call};`
        }
        case 'VARIABLE_DECL':
            variableTypes.set(stmt.name, stmt.type)
            if (implicitRepresentation(stmt.type) === 'big')
                blockLocals[blockLocals.length - 1]?.push(stmt.name)
            return `${lowerType(stmt.type)} ${stmt.name} = ${lowerConverted(stmt.initialValue, stmt.type)};`
        case 'ASSIGN':
            if (
                stmt.target.kind === 'VARIABLE_REF' &&
                stmt.value.kind === 'ALLOCATION'
            )
                return `memcpy(&${lowerStorage(stmt.target)}->properties, &(${mangleTypeName(stmt.value.type)}ˇproperties){
                        ${stmt.value.properties?.map((property) => `.${property.name} = ${lowerPropertyValue(stmt.value.type, property)}`).join(', ') ?? ''}
                    },
                    sizeof(${mangleTypeName(stmt.value.type)}ˇproperties));`
            else if (stmt.target.kind === 'PROPERTY_REF') {
                const target = lowerStorage(stmt.target)
                const value = lowerPropertyValue(stmt.target.object.type, {
                    name: stmt.target.property,
                    value: stmt.value,
                })
                const type = propertyTypeOf(
                    stmt.target.object.type,
                    stmt.target.property,
                )
                return type && implicitRepresentation(type) === 'big'
                    ? `{ Integer *oldˇ = ${target}; ${target} = ${value}; releaseRC(oldˇ); }`
                    : `${target} = ${value};`
            } else if (targetType(stmt.target) === undefined)
                return `${lowerStorage(stmt.target)} = ${lowerExpr(stmt.value)};`
            else if (isImplicitBig(targetType(stmt.target)!))
                // The backend owns implicit Integer* values and releases the old one.
                return `{ Integer *oldˇ = ${lowerStorage(stmt.target)}; ${lowerStorage(stmt.target)} = ${lowerConverted(stmt.value, targetType(stmt.target)!)}; releaseRC(oldˇ); }`
            else
                return `${lowerStorage(stmt.target)} = ${lowerConverted(stmt.value, targetType(stmt.target)!)};`
        case 'SELF_INIT':
            return `memcpy(&self->properties, &(${mangleTypeName(stmt.type)}ˇproperties){
                    ${stmt.properties?.map((property) => `.${property.name} = ${lowerPropertyValue(stmt.type, property)}`).join(', ') ?? ''}
                },
                sizeof(${mangleTypeName(stmt.type)}ˇproperties));`
        case 'ENSURE_UNIQUE':
            return `mutateRC(${lowerStorage(stmt.object)});`
        case 'RELEASE':
            return `releaseRC(${lowerStorage(stmt.object)});`
        case 'RETURN': {
            const value = stmt.value
                ? lowerConverted(stmt.value, currentReturnType as cir.ValueSet)
                : undefined
            const { pre, post } = drainTemps()
            const releases = (blockLocals[blockLocals.length - 1] ?? [])
                .map((name) => `releaseRC(${name});`)
                .join('\n')
            if (!value) return [releases, 'return;'].filter(Boolean).join('\n')
            if (!pre && !post && !releases) return `return ${value};`
            return [
                pre,
                `${lowerType(currentReturnType)} retˇ = ${value};`,
                post,
                releases,
                'return retˇ;',
            ]
                .filter(Boolean)
                .join('\n')
        }
        default:
            throw new Error(`Unknown statement kind: ${(stmt as any).kind}`)
    }
}

export function lowerInitStmt(stmt: cir.Statement): string {
    switch (stmt.kind) {
        case 'VARIABLE_DECL': {
            const saved = temps
            temps = []
            const assignment = `${stmt.name} = ${lowerConverted(stmt.initialValue, stmt.type)};`
            const { pre, post } = drainTemps()
            temps = saved
            return [pre, assignment, post].filter(Boolean).join('\n')
        }
        default:
            return lowerStmt(stmt)
    }
}

export function lowerExpr(expr: cir.Expression): string {
    switch (expr.kind) {
        case 'RETAIN':
            return `retainRC(${lowerStorage(expr.object)})`
        case 'STRING_LITERAL':
            return `"${expr.type.value}"`
        case 'INTEGER_LITERAL':
            return integerRepresentation(expr.type) === 'native'
                ? expr.type.value
                : `Integer¸fromCString("${expr.type.value}")`
        case 'TRUTHVALUE_LITERAL':
            return lowerTruthvalueLiteral(expr)
        case 'CALL':
            return lowerFunctionCall(expr)
        case 'VARIABLE_REF':
            return expr.name
        case 'PROPERTY_REF':
            return `${lowerExpr(expr.object)}->properties.${expr.property}`
        case 'AS_SHARED':
            return `shareRC(${lowerExpr(expr.object)})`
        case 'BOX':
            switch (expr.type.universe) {
                case 'truthvalue':
                    return `boxTruthvalue(${lowerExpr(expr.expression)})`
                case 'integer':
                    return operandRepresentation(expr.expression) === 'big'
                        ? lowerOwned(expr.expression, 'big')
                        : `integerWithDigits(1, ${lowerExpr(expr.expression)})`
                default:
                    throw new Error(
                        `Unknown box universe: ${expr.expression.type.universe}`,
                    )
            }
        case 'ALLOCATION':
            const mangledTypeName = mangleTypeName(expr.type)
            return `allocInitRC(${mangledTypeName}, 0, ${`__rc_${expr.isolationLevel}`},
                ${expr.properties?.map((property) => `.${property.name} = ${lowerPropertyValue(expr.type, property)}`).join(', ') ?? ''}
            )`
        case 'OR':
            // Cast necessary because of shared mutable state. TypeScript cannot merge Truth[] and (false | true)[] into one type as they are contra-variant.
            // Of course, `includes()` is a read-only operation, which is always safe, but TypeScript is incapable of drawing that conclusion.
            const values: cir.truthvalue[] =
                'value' in expr.left.type
                    ? [expr.left.type.value]
                    : 'values' in expr.left.type
                      ? expr.left.type.values
                      : ['false', 'ambiguous', 'true']
            if (values.includes('ambiguous'))
                throw new Error('ambiguity not yet supported')
            return `(${lowerExpr(expr.left)}) || (${lowerExpr(expr.right)})`
        case 'AND':
            return `(${lowerExpr(expr.left)}) && (${lowerExpr(expr.right)})`
        case 'EQUAL':
            return (
                lowerIntegerComparison(expr, 'eq', '==') ??
                `(${lowerExpr(expr.left)}) == (${lowerExpr(expr.right)})`
            )
        case 'NOT_EQUAL':
            return (
                lowerIntegerComparison(expr, 'ne', '!=') ??
                `(${lowerExpr(expr.left)}) != (${lowerExpr(expr.right)})`
            )
        case 'LESS_THAN':
            return (
                lowerIntegerComparison(expr, 'lt', '<') ??
                `(${lowerExpr(expr.left)}) < (${lowerExpr(expr.right)})`
            )
        case 'GREATER_THAN':
            return (
                lowerIntegerComparison(expr, 'gt', '>') ??
                `(${lowerExpr(expr.left)}) > (${lowerExpr(expr.right)})`
            )
        case 'LESS_THAN_OR_EQUAL':
            return (
                lowerIntegerComparison(expr, 'le', '<=') ??
                `(${lowerExpr(expr.left)}) <= (${lowerExpr(expr.right)})`
            )
        case 'GREATER_THAN_OR_EQUAL':
            return (
                lowerIntegerComparison(expr, 'ge', '>=') ??
                `(${lowerExpr(expr.left)}) >= (${lowerExpr(expr.right)})`
            )
        case 'SAME':
            return `(${lowerExpr(expr.left)}) == (${lowerExpr(expr.right)})`
        case 'NOT_SAME':
            return `(${lowerExpr(expr.left)}) != (${lowerExpr(expr.right)})`
        case 'ADDITION':
        case 'SUBTRACTION':
        case 'MULTIPLICATION':
        case 'DIVISION':
        case 'MODULUS':
        case 'EXPONENTIAL':
            return lowerIntegerArithmetic(expr)
        default:
            throw new Error(`Unknown expression kind: ${(expr as any).kind}`)
    }
}

const NATIVE_OPERATORS = {
    ADDITION: '+',
    SUBTRACTION: '-',
    MULTIPLICATION: '*',
} as const

const BIG_ARITHMETIC = {
    ADDITION: 'add',
    SUBTRACTION: 'subtract',
    MULTIPLICATION: 'multiply',
    DIVISION: 'floorDivide',
    MODULUS: 'modulus',
    EXPONENTIAL: 'power',
} as const

function operandRepresentation(expr: cir.Expression): Representation {
    const representation = implicitRepresentation(storageType(expr))
    if (representation === undefined)
        throw new Error(
            `Arithmetic on ${expr.type.universe} values is not yet supported`,
        )
    return representation
}

function lowerIntegerArithmetic(
    expr: cir.Expression & {
        kind: keyof typeof BIG_ARITHMETIC
    },
): string {
    const result = operandRepresentation(expr)
    const left = operandRepresentation(expr.left)
    const right = operandRepresentation(expr.right)
    if (result === 'native' && left === 'native' && right === 'native') {
        const l = lowerExpr(expr.left)
        const r = lowerExpr(expr.right)
        switch (expr.kind) {
            case 'DIVISION':
                return `floorDiv64(${l}, ${r})`
            case 'MODULUS':
                return `floorMod64(${l}, ${r})`
            case 'EXPONENTIAL':
                break
            default:
                return `(${l}) ${NATIVE_OPERATORS[expr.kind]} (${r})`
        }
    }
    const call = `Integer¸${BIG_ARITHMETIC[expr.kind]}(${lowerBorrowed(expr.left, 'big')}, ${lowerBorrowed(expr.right, 'big')})`
    return result === 'big' ? call : `Integer·toInt64(${hoist(call)})`
}

/** Lowers a comparison of implicit integers, or undefined for other operands. */
function lowerIntegerComparison(
    expr: cir.Expression & { left: cir.Expression; right: cir.Expression },
    name: string,
    operator: string,
): string | undefined {
    const left = implicitRepresentation(storageType(expr.left))
    const right = implicitRepresentation(storageType(expr.right))
    if (left === undefined || right === undefined) return undefined
    if (left === 'native' && right === 'native')
        return `((${lowerExpr(expr.left)}) ${operator} (${lowerExpr(expr.right)}) ? c_true : c_false)`
    return `Integer¸${name}(${lowerBorrowed(expr.left, 'big')}, ${lowerBorrowed(expr.right, 'big')})`
}

export function lowerStorage(
    expr:
        | Omit<cir.Expression & { kind: 'VARIABLE_REF' }, 'type'>
        | Omit<cir.Expression & { kind: 'PROPERTY_REF' }, 'type'>,
): string {
    switch (expr.kind) {
        case 'VARIABLE_REF':
            return expr.name
        case 'PROPERTY_REF':
            return `${lowerExpr(expr.object)}->properties.${expr.property}`
        default:
            throw new Error(`Unknown expression kind: ${(expr as any).kind}`)
    }
}

function signatureOf(call: cir.Statement & { kind: 'CALL' }) {
    const receiver = call.receiver
    return signatures.get(
        mangleNameWithLabels(
            call.name,
            receiver && receiver.dispatch !== 'conformance'
                ? (receiver.object.type as { name: string; namespace?: string })
                : undefined,
        ),
    )
}

function lowerFunctionCall(call: cir.Statement & { kind: 'CALL' }) {
    const receiver = call.receiver
    const signature = signatureOf(call)
    const args = call.arguments.map((arg, i) =>
        lowerArgument(arg, signature?.parameters[i]),
    )
    switch (receiver?.dispatch) {
        case undefined: {
            const name = mangleNameWithLabels(call.name)
            return `${name}(${args.join(', ')})`
        }
        case 'direct': {
            const name = mangleNameWithLabels(call.name, receiver.object.type)
            return `${name}(${[lowerExpr(receiver.object), ...args].join(', ')})`
        }
        case 'inherited': {
            const targetName = lowerExpr(receiver.object)
            const declarationType = mangleTypeName(receiver.object.type)
            const slotName = mangleNameWithLabels({
                ...call.name,
                namespace: undefined,
            })
            return `VTABLE(${targetName}, ${declarationType})->${slotName}(${[lowerExpr(receiver.object), ...args]})`
        }
        case 'conformance':
        default:
            throw new Error(
                `Dispatch mode of ${receiver?.dispatch} not yet supported`,
            )
    }
}

export function lowerTruthvalueLiteral(
    expr: Extract<cir.Expression, { kind: 'TRUTHVALUE_LITERAL' }>,
): string {
    return `c_${expr.type.value}`
}

function mangleNameWithParameters(
    decl: FunctionSignature | (FunctionSignature & { namespace?: string }),
    receiver?: { name: string; namespace?: string },
): string {
    return mangleNameWithLabels(decl, receiver)
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

type FunctionSignature = (cir.Declaration & {
    kind: 'INTERFACE_DECL'
})['methods'][number]
