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
let temps: { name: string; init: string; type: string }[] = []
let tempCounter = 0
// Implicit `Integer*` locals of the blocks being lowered, innermost last.
const blockLocals: string[][] = []
let currentReturnType: cir.ValueSet | { universe: 'void' } = {
    universe: 'void',
}

function hoist(init: string, type = 'Integer*'): string {
    const name = `tmpˇ${tempCounter++}`
    temps.push({ name, init, type })
    return name
}

function drainTemps(): { pre: string; post: string } {
    const drained = temps
    temps = []
    return {
        pre: drained.map((t) => `${t.type} ${t.name} = ${t.init};`).join('\n'),
        post: drained.map((t) => `releaseRC(${t.name});`).join('\n'),
    }
}

function lowerContainedExpression(expr: cir.Expression): string {
    const saved = temps
    temps = []
    try {
        const value = lowerExpr(expr)
        const { pre, post } = drainTemps()
        if (!pre && !post) return value
        const result = `exprˇresult${tempCounter++}`
        return `({ ${pre} ${lowerType(expr.type)} ${result} = ${value}; ${post} ${result}; })`
    } finally {
        temps = saved
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
    interfaceNames.clear()
    interfaceDecls.clear()
    typeDecls.clear()
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

    for (const decl of cir.declarations ?? [])
        if (decl.kind === 'INTERFACE_DECL') {
            interfaceNames.add(mangleTypeName(decl))
            interfaceDecls.set(mangleTypeName(decl), decl)
        } else if (decl.kind === 'RC_TYPE_DECL')
            typeDecls.set(mangleTypeName(decl), decl)
    registerSignatures(cir.declarations ?? [])
    registerSignature('clawr¸newHashBuilder', {
        parameters: [],
        returnType: {
            universe: 'rc-type',
            namespace: 'clawr',
            name: 'HashBuilder',
        },
    })
    registerSignature('clawr¸HashBuilder·add', {
        parameters: [
            {
                universe: 'interface',
                namespace: 'clawr',
                name: 'HashEquatable',
            },
        ],
        returnType: { universe: 'void' },
    })

    const variableDecls =
        cir.declarations?.filter((decl) => decl.kind === 'VARIABLE_DECL') ?? []
    return `#include <stdio.h>
        #include "runtime.h"
        ${(cir.declarations ?? [])
            .filter((decl) => decl.kind === 'RC_TYPE_DECL')
            .map(
                (decl) =>
                    `typedef struct ${mangleTypeName(decl)} ${mangleTypeName(decl)};`,
            )
            .join('\n')}
        ${(cir.declarations ?? [])
            .filter((decl) => decl.kind === 'RC_TYPE_DECL')
            .map((decl) => lowerRCStructure(decl))
            .join('\n')}
        ${(cir.declarations ?? [])
            .filter((decl) => decl.kind === 'RC_TYPE_DECL')
            .map(
                (decl) =>
                    `static const __type_info ${mangleTypeName(decl)}ˇtype;`,
            )
            .join('\n')}
        ${(cir.declarations ?? [])
            .filter((decl) => decl.kind === 'FUNCTION_DECL')
            .map(
                (decl) =>
                    `${functionSignature(decl, mangleNameWithParameters(decl))};`,
            )
            .join('\n')}
        ${(cir.declarations ?? [])
            .filter((decl) => decl.kind === 'RC_TYPE_DECL' && 'methods' in decl)
            .flatMap((decl) =>
                'methods' in decl
                    ? [
                          ...decl.methods.map(
                              (method) =>
                                  `${memberSignature(method, decl, false)};`,
                          ),
                          ...decl.initializers.map(
                              (initializer) =>
                                  `${memberSignature(initializer, decl, true)};`,
                          ),
                      ]
                    : [],
            )
            .join('\n')}
        ${
            cir.declarations
                ? [...cir.declarations]
                      .sort(declarationOrder)
                      .map((decl) => lowerDecl(decl, true))
                      .join('\n')
                : ''
        }
        ${variableDecls?.length ? lowerInit(variableDecls) : ''}
        int main() {
            ${cir.startBlock ? lowerBlock(cir.startBlock, { universe: 'void' }, []) : ''}
            return 0;
        }
        `
}

const interfaceNames = new Set<string>()
const interfaceDecls = new Map<
    string,
    cir.Declaration & { kind: 'INTERFACE_DECL' }
>()
const typeDecls = new Map<string, cir.Declaration & { kind: 'RC_TYPE_DECL' }>()

function declarationOrder(a: cir.Declaration, b: cir.Declaration) {
    const rank = (decl: cir.Declaration) =>
        decl.kind === 'INTERFACE_DECL'
            ? 0
            : decl.kind === 'VARIABLE_DECL'
              ? 1
              : decl.kind === 'RC_TYPE_DECL'
                ? 2
                : 3
    return rank(a) - rank(b)
}

/**
 * Properties holding pointers (rc-types, boxed values and implicit `Integer*`
 * values) are owned by the entity, so copy-on-write and deallocation must
 * retain and release them.
 */
function lowerNestedHooks(
    decl: cir.Declaration & { kind: 'RC_TYPE_DECL' },
    ownedProperties: { name: string }[],
): { code: string; properties: string } {
    const base = 'base' in decl ? decl.base : undefined
    if (!ownedProperties.length && !base) return { code: '', properties: '' }
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
        properties: `, .retain_nested_properties = ${name}ˇretainNested, .release_nested_properties = ${name}ˇreleaseNested`,
    }
}

function lowerRCStructure(
    decl: cir.Declaration & { kind: 'RC_TYPE_DECL' },
): string {
    const name = mangleTypeName(decl)
    const properties = decl.properties
        .map((property) => `${lowerType(property.type)} ${property.name};`)
        .join('\n')
    return `typedef struct {
        ${properties}
    } ${name}ˇproperties;
    typedef struct ${name} {
        ${'base' in decl && decl.base ? `${mangleTypeName(decl.base)} super` : '__rc_header header'};
        ${name}ˇproperties properties;
    } ${name};`
}

export function lowerDecl(
    decl: cir.Declaration,
    structureAlreadyEmitted = false,
): string {
    switch (decl.kind) {
        case 'RC_TYPE_DECL': {
            const mangledTypeName = mangleTypeName(decl)
            const structure = structureAlreadyEmitted
                ? ''
                : lowerRCStructure(decl)
            const ownedProperties = decl.properties.filter((property) =>
                isPointerType(property.type),
            )
            const nestedHooks = lowerNestedHooks(decl, ownedProperties)
            if (!('methods' in decl))
                return `${structure}
                    ${nestedHooks.code}
                    static const __type_info ${mangledTypeName}ˇtype = {
                        .data_type = { .size = sizeof(${mangledTypeName}) ${nestedHooks.properties} }
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
            const conformances = lowerConformances(decl)
            const dataProperties = `${nestedHooks.properties}${conformances.property}`
            const typeInfo = decl.dispatchTable
                ? `.polymorphic_type = {
                        .data = { .size = sizeof(${mangledTypeName}) ${dataProperties} },
                        ${decl.base ? `.super = &${mangleTypeName(decl.base)}ˇtype.polymorphic_type,` : ''}
                        .vtable = &(${mangledTypeName}ˇvtable){
                            ${vtableMethods}
                        }
                    }`
                : `.data_type = { .size = sizeof(${mangledTypeName}) ${dataProperties} }`
            return `${structure}
            ${vtableTypedefs.join('\n')}
            ${vtableStruct}
            ${nestedHooks.code}
            ${decl.methods?.map((m) => lowerMethod(m, decl)).join('\n') ?? ''}
            ${conformances.code}
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
                __interface_info ${mangleTypeName(decl)}ˇtype = {
                    .name = "${mangleTypeName(decl)}"
                };`

        default:
            throw new Error(`Unknown declaration kind: ${(decl as any).kind}`)
    }
}

/**
 * Each conformance gets a witness table of the type's own (or inherited)
 * implementations, found at runtime through the type info.
 */
function lowerConformances(decl: cir.Declaration & { kind: 'RC_TYPE_DECL' }): {
    code: string
    property: string
} {
    const conformances = decl.conformances ?? []
    if (!conformances.length) return { code: '', property: '' }
    const typeName = mangleTypeName(decl)
    const dispatchTable = 'dispatchTable' in decl ? decl.dispatchTable : []
    const owner = (name: { baseName: string; labels: string[] }) =>
        dispatchTable?.find(
            ({ slot }) =>
                slot.baseName === name.baseName &&
                slot.labels.join() === name.labels.join(),
        )?.implementation ?? decl

    const code = conformances.map(({ interface: iface, fulfillments }) => {
        const interfaceName = mangleTypeName(iface)
        const witness = `${typeName}ˇ${interfaceName}ˇwitness`
        const thunks: string[] = []
        const slots = fulfillments.map(({ requirement, implementation }) => {
            const slotName = mangleNameWithLabels(requirement)
            const ownerDecl = owner(implementation)
            const implName = mangleNameWithLabels(implementation, ownerDecl)
            const type = typeDecls.get(mangleTypeName(ownerDecl))
            const thunk = lowerWitnessThunk(
                `${typeName}ˇ${interfaceName}ˇ${slotName}`,
                implName,
                interfaceDecls
                    .get(interfaceName)
                    ?.methods.find((m) => m.baseName === requirement.baseName),
                type && 'methods' in type
                    ? type.methods.find(
                          (m) => m.baseName === implementation.baseName,
                      )
                    : undefined,
                mangleTypeName(ownerDecl),
            )
            if (thunk) thunks.push(thunk.code)
            const target = thunk?.name ?? implName
            return `.${slotName} = (__typeof__(((${interfaceName}ˇwitness *)0)->${slotName}))${target},`
        })
        return `${thunks.join('\n')}
            static const ${interfaceName}ˇwitness ${witness} = { ${slots.join('\n')} };
            static const __interface_conformance_entry ${typeName}ˇ${interfaceName}ˇconformance = {
                .interface = &${interfaceName}ˇtype,
                .witness_table = &${witness}
            };`
    })
    const entries = conformances.map(
        ({ interface: iface }) =>
            `&${typeName}ˇ${mangleTypeName(iface)}ˇconformance`,
    )
    return {
        code: code.join('\n'),
        property: `, .conformances = (const __interface_conformance_entry *[]){ ${entries.join(', ')}, NULL }`,
    }
}

/**
 * An implementation may promise a narrower result than the interface
 * requires, which can mean a different representation (`int64_t` versus
 * `Integer*`). A thunk converts the result so the witness matches the slot.
 */
function lowerWitnessThunk(
    name: string,
    implementation: string,
    required: FunctionSignature | undefined,
    implemented: FunctionSignature | undefined,
    ownerType: string,
): { name: string; code: string } | undefined {
    if (!required || !implemented) return undefined
    const requiredType = lowerType(required.returnType)
    const implementedType = lowerType(implemented.returnType)
    if (requiredType === implementedType) return undefined
    const params = required.parameters.map(
        (p) => `${lowerType(p.type)} ${p.name}`,
    )
    const args = required.parameters.map((p) => p.name)
    const call = `${implementation}((${ownerType}*)self${args.map((a) => `, ${a}`).join('')})`
    const converted =
        implementedType === 'int64_t' && requiredType === 'Integer*'
            ? `Integer¸fromInt64(${call})`
            : call
    return {
        name,
        code: `static ${requiredType} ${name}(${['void* self', ...params].join(', ')}) {
            return ${converted};
        }`,
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

function memberSignature(
    decl: cir.Declaration & { kind: 'FUNCTION_DECL' },
    receiverType: cir.Declaration & { kind: 'RC_TYPE_DECL' },
    initializer: boolean,
): string {
    return functionSignature(
        {
            ...decl,
            returnType: initializer
                ? { universe: 'rc-type', name: 'void' }
                : decl.returnType,
            parameters: [
                {
                    name: 'self',
                    type: {
                        universe: 'rc-type',
                        name: receiverType.name,
                        namespace: receiverType.namespace,
                    },
                },
                ...decl.parameters,
            ],
        },
        mangleNameWithParameters(decl, receiverType),
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

function functionSignature(
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

    return `${returnType} ${mangledName}(${params})`
}

function lowerFunction(
    decl: cir.Declaration & { kind: 'FUNCTION_DECL' },
    mangledName: string,
) {
    return `${functionSignature(decl, mangledName)} {
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
        case 'real':
            if (valueSet.boxed) return 'Real*'
            const representation = realRepresentation(valueSet)
            return representation === 'managed'
                ? 'Real*'
                : BINARY_FORMATS[representation].ctype
        case 'truthvalue':
            return valueSet.boxed ? 'TruthvalueBox*' : 'truthvalue_t'
        case 'string':
            return 'String*'
        case 'rc-type':
            // Interfaces are named like types where the frontend resolved them early
            return interfaceNames.has(mangleTypeName(valueSet))
                ? 'void*'
                : `${valueSet.name}*`
        case 'interface':
            return 'void*'
        case 'void':
            return 'void'
        default:
            throw new Error(
                `Unknown value set universe: ${(valueSet as any).universe}`,
            )
    }
}

// 'managed' values are runtime `Real*` objects: decimal, or binary of any width.
type RealRepresentation = 'managed' | 'binary16' | 'binary32' | 'binary64'
type BinaryRepresentation = Exclude<RealRepresentation, 'managed'>

// Native IEEE formats: significand bits, largest finite value, C type, runtime prefix.
const BINARY_FORMATS: Record<
    BinaryRepresentation,
    { bits: number; max: number; ctype: string; prefix: string }
> = {
    binary16: { bits: 11, max: 65504, ctype: '_Float16', prefix: 'Real16' },
    binary32: {
        bits: 24,
        max: 3.4028234663852886e38,
        ctype: 'float',
        prefix: 'Real32',
    },
    binary64: {
        bits: 53,
        max: 1.7976931348623157e308,
        ctype: 'double',
        prefix: 'Real64',
    },
}

function binaryLiteral(representation: BinaryRepresentation, value: string) {
    if (!Number.isFinite(Number(value)))
        throw new Error('Real literal is not a finite number')
    switch (representation) {
        case 'binary16':
            return `${value}f16`
        case 'binary32':
            return `strtof("${value}", NULL)`
        case 'binary64':
            return `strtod("${value}", NULL)`
    }
}

// Binary hardware cannot hold ternary grids exactly; `sig n ter` is stored in
// the narrowest binary grid at least as precise (ADR-025): p >= 1 + ceil(n*log2(3)).
function storagePrecision(precision: cir.RealPrecision): cir.RealPrecision {
    if (precision.base !== 'ter' || precision.kind !== 'sig') return precision
    return {
        ...precision,
        base: 'bin',
        digits: 1 + Math.ceil(precision.digits * Math.log2(3) - 1e-12),
    }
}

function realRepresentation(valueSet: cir.RealSet): RealRepresentation {
    // Boxed reals are always runtime `Real*` values, whatever their precision base.
    if (valueSet.boxed) return 'managed'
    const declared = valueSet.precision
    if (
        !declared ||
        !Number.isSafeInteger(declared.digits) ||
        declared.digits < 0
    )
        throw new Error('Real lowering requires an explicit valid precision')
    const precision = storagePrecision(declared)
    if (declared.base === 'ter' && declared.kind === 'sig') return 'managed'
    if (precision.base === 'dec' || precision.kind === 'scale') return 'managed'
    if (precision.base !== 'bin')
        throw new Error(
            `Real precision ${precision.kind} ${precision.digits} ${precision.base} is not supported by this backend`,
        )
    const entry = Object.entries(BINARY_FORMATS).find(
        ([, f]) => f.bits === precision.digits,
    ) as
        | [BinaryRepresentation, (typeof BINARY_FORMATS)[BinaryRepresentation]]
        | undefined
    // Widths without a native C type, and ranges other than the full finite
    // range of the format, use arbitrary-precision runtime values.
    if (!entry) return 'managed'
    const [representation, format] = entry
    if ('min' in valueSet && 'max' in valueSet)
        return Number(valueSet.min) === -format.max &&
            Number(valueSet.max) === format.max
            ? representation
            : 'managed'
    if ('value' in valueSet) {
        const value = Number(valueSet.value)
        return Number.isFinite(value) && Math.abs(value) <= format.max
            ? representation
            : 'managed'
    }
    return 'managed'
}

function realExpressionRepresentation(
    expr: cir.Expression,
): RealRepresentation {
    return expr.type.universe === 'real'
        ? realRepresentation(expr.type)
        : 'managed'
}

function isPointerType(valueSet: cir.ValueSet): boolean {
    return lowerType(valueSet).endsWith('*')
}

function isManagedReal(valueSet: cir.ValueSet): boolean {
    return (
        valueSet.universe === 'real' &&
        realRepresentation(valueSet) === 'managed'
    )
}

function isManagedOwnedType(valueSet: cir.ValueSet): boolean {
    return (
        isImplicitBig(valueSet) ||
        isManagedReal(valueSet) ||
        valueSet.universe === 'string'
    )
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

// A literal's value is exact, so it can adopt the precision of its target.
function lowerLiteralAtPrecision(
    expr: cir.Expression,
    target: cir.RealSet,
): string | undefined {
    const declared = target.precision
    const precision = declared && storagePrecision(declared)
    if (expr.kind !== 'REAL_LITERAL' || !precision || !isManagedReal(expr.type))
        return undefined
    const value = expr.type.value.replaceAll('_', '')
    return realFromText(value, precision)
}

// Runtime function suffix and trailing arguments for a precision's grid:
// `sig n bin` rounds to n bits, `scale n` in base 2 or 3 rounds to a multiple
// of base^-n, and decimal reals take the precision and whether it is a scale.
function gridCall(declared: cir.RealPrecision) {
    const precision = storagePrecision(declared)
    if (precision.kind === 'scale' && precision.base !== 'dec')
        return {
            suffix: 'Scale',
            args: `${precision.digits}, ${precision.base === 'bin' ? 2 : 3}`,
            roundArgs: `${precision.digits}, ${precision.base === 'bin' ? 2 : 3}`,
        }
    if (precision.base === 'bin')
        return {
            suffix: 'Binary',
            args: `${precision.digits}`,
            roundArgs: `${precision.digits}`,
        }
    return {
        suffix: '',
        args: `${precision.digits}, ${precision.kind === 'scale'}`,
        roundArgs: `${precision.digits}`,
    }
}

function realFromText(value: string, declared: cir.RealPrecision): string {
    const grid = gridCall(declared)
    return `Real¸fromString${grid.suffix}("${value}", ${grid.args})`
}

function realRound(value: string, declared: cir.RealPrecision): string {
    const grid = gridCall(declared)
    return `Real¸${grid.suffix ? `round${grid.suffix}` : 'round'}(${value}, ${grid.roundArgs})`
}

// Lowers an integer to a managed real of the given precision.
function lowerIntegerToReal(
    expr: cir.Expression,
    declared: cir.RealPrecision,
): string {
    const grid = gridCall(declared)
    const native = integerRepresentation(expr.type as any) === 'native'
    const value = native ? lowerExpr(expr) : lowerBorrowed(expr, 'big')
    return `Real¸from${native ? 'Int64' : 'Integer'}${grid.suffix}(${value}, ${grid.args})`
}

function lowerRealBorrowed(
    expr: cir.Expression,
    resultType: cir.RealSet,
): string {
    const literal = lowerLiteralAtPrecision(expr, resultType)
    if (literal) return hoist(literal, 'Real*')
    if (expr.type.universe === 'integer') {
        const precision = resultType.precision
        if (!precision) throw new Error('Real conversion requires precision')
        return hoist(lowerIntegerToReal(expr, precision), 'Real*')
    }

    const nativeOperand = nativeToManaged(expr)
    if (nativeOperand) return nativeOperand
    if (expr.type.universe !== 'real' || !isManagedReal(expr.type))
        throw new Error('Incompatible representation for decimal real operand')
    const sourcePrecision = expr.type.precision
    const resultPrecision = resultType.precision
    if (!sourcePrecision || !resultPrecision)
        throw new Error('Real values require explicit precision')
    if (
        sourcePrecision.kind !== resultPrecision.kind ||
        sourcePrecision.base !== resultPrecision.base
    )
        throw new Error(
            'Implicit conversions between real precision kinds or bases are not supported',
        )
    let lowered = lowerExpr(expr)
    if (expr.kind !== 'VARIABLE_REF' && expr.kind !== 'PROPERTY_REF')
        lowered = hoist(lowered, 'Real*')
    if (sourcePrecision.digits !== resultPrecision.digits)
        lowered = hoist(realRound(lowered, resultPrecision), 'Real*')
    return lowered
}

// An IEEE value converts exactly to an arbitrary-precision real.
function nativeToManaged(expr: cir.Expression): string | undefined {
    if (expr.type.universe !== 'real') return undefined
    const representation = realRepresentation(expr.type)
    if (representation === 'managed') return undefined
    const { bits } = BINARY_FORMATS[representation]
    return hoist(
        `Real¸fromBinary((double)(${lowerExpr(expr)}), ${bits})`,
        'Real*',
    )
}

function lowerRealOwned(expr: cir.Expression, target: cir.RealSet): string {
    const literal = lowerLiteralAtPrecision(expr, target)
    if (literal) return literal
    if (expr.type.universe === 'integer') {
        const precision = target.precision
        if (!precision) throw new Error('Real conversion requires precision')
        return lowerIntegerToReal(expr, precision)
    }
    if (
        expr.type.universe !== 'real' ||
        !isManagedReal(expr.type) ||
        !isManagedReal(target)
    )
        throw new Error('Incompatible representation for decimal real value')
    const sourcePrecision = expr.type.precision
    const targetPrecision = target.precision
    if (!sourcePrecision || !targetPrecision)
        throw new Error('Real values require explicit precision')
    if (
        sourcePrecision.kind !== targetPrecision.kind ||
        sourcePrecision.base !== targetPrecision.base
    )
        throw new Error(
            'Implicit conversions between real precision kinds or bases are not supported',
        )
    if (sourcePrecision.digits !== targetPrecision.digits)
        return realRound(lowerRealBorrowed(expr, expr.type), targetPrecision)
    return expr.kind === 'VARIABLE_REF' || expr.kind === 'PROPERTY_REF'
        ? `retainRC(${lowerExpr(expr)})`
        : lowerExpr(expr)
}

function lowerRealExactBorrowed(expr: cir.Expression): string {
    if (expr.type.universe === 'integer') {
        const converted =
            integerRepresentation(expr.type) === 'native'
                ? `Real¸fromInt64(${lowerExpr(expr)}, 0, true)`
                : `Real¸fromInteger(${lowerBorrowed(expr, 'big')}, 0, true)`
        return hoist(converted, 'Real*')
    }
    const nativeOperand = nativeToManaged(expr)
    if (nativeOperand) return nativeOperand
    if (expr.type.universe !== 'real' || !isManagedReal(expr.type))
        throw new Error(
            'Incompatible representation for decimal real comparison',
        )
    const lowered = lowerExpr(expr)
    return expr.kind === 'VARIABLE_REF' || expr.kind === 'PROPERTY_REF'
        ? lowered
        : hoist(lowered, 'Real*')
}

function lowerRealRangeChecked(value: string, target: cir.RealSet): string {
    if (!isManagedReal(target)) return value
    const min =
        'min' in target && target.min !== undefined ? `"${target.min}"` : 'NULL'
    const max =
        'max' in target && target.max !== undefined ? `"${target.max}"` : 'NULL'
    return min === 'NULL' && max === 'NULL'
        ? value
        : `Real¸ensureInRange(${value}, ${min}, ${max})`
}

// Decimal literals are exact, so they convert to a binary target by one
// round-to-nearest. Other decimal-to-binary conversions remain unsupported.
function lowerLiteralToBinary(
    expr: cir.Expression,
    target: cir.RealSet,
): string | undefined {
    if (expr.kind !== 'REAL_LITERAL' || !isManagedReal(expr.type))
        return undefined
    const representation = realRepresentation(target)
    if (representation === 'managed') return undefined
    const value = expr.type.value.replaceAll('_', '')
    if (Math.abs(Number(value)) > BINARY_FORMATS[representation].max)
        throw new Error(
            'Real literal is outside the finite range of its target',
        )
    return binaryLiteral(representation, value)
}

/** Lowers `expr` for storing in a location of type `target`. */
function lowerConverted(expr: cir.Expression, target: cir.ValueSet): string {
    if (
        target.universe === 'string' &&
        (expr.kind === 'VARIABLE_REF' || expr.kind === 'PROPERTY_REF')
    )
        return `retainRC(${lowerExpr(expr)})`
    if (target.universe === 'real') {
        if (isManagedReal(target))
            return lowerRealRangeChecked(lowerRealOwned(expr, target), target)
        const literal = lowerLiteralToBinary(expr, target)
        if (literal) return literal
        if (
            expr.type.universe !== 'real' ||
            realExpressionRepresentation(expr) !== realRepresentation(target)
        )
            throw new Error(
                'Implicit conversions to IEEE real representations are not supported',
            )
    }
    const to = implicitRepresentation(target)
    return to === undefined ? lowerExpr(expr) : lowerOwned(expr, to)
}

/** Lowers a call argument for a parameter of type `parameter`. */
function lowerArgument(expr: cir.Expression, parameter?: cir.ValueSet) {
    if (expr.kind === 'BOX') return hoist(lowerExpr(expr), lowerType(expr.type))
    if (
        isHashBuilder(expr.type) &&
        expr.kind !== 'VARIABLE_REF' &&
        expr.kind !== 'PROPERTY_REF'
    )
        return hoist(lowerExpr(expr), lowerType(expr.type))
    if (
        expr.type.universe === 'string' &&
        expr.kind !== 'VARIABLE_REF' &&
        expr.kind !== 'PROPERTY_REF'
    )
        return hoist(lowerExpr(expr), 'String*')
    if (parameter?.universe === 'real' && isManagedReal(parameter))
        return lowerRealRangeChecked(
            lowerRealBorrowed(expr, parameter),
            parameter,
        )
    if (parameter?.universe === 'real') {
        const literal = lowerLiteralToBinary(expr, parameter)
        if (literal) return literal
        if (
            expr.type.universe !== 'real' ||
            realExpressionRepresentation(expr) !== realRepresentation(parameter)
        )
            throw new Error(
                'Implicit conversions to IEEE real representations are not supported',
            )
    }
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
            if (
                returned &&
                returned.universe !== 'void' &&
                (isManagedOwnedType(returned) ||
                    (returned.universe === 'rc-type' &&
                        returned.namespace === 'clawr' &&
                        returned.name === 'HashBuilder'))
            ) {
                hoist(call, lowerType(returned))
                return ''
            }
            return `${call};`
        }
        case 'VARIABLE_DECL':
            variableTypes.set(stmt.name, stmt.type)
            if (isManagedOwnedType(stmt.type))
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
                return type && isManagedOwnedType(type)
                    ? `{ ${lowerType(type)} oldˇ = ${target}; ${target} = ${value}; releaseRC(oldˇ); }`
                    : `${target} = ${value};`
            } else if (targetType(stmt.target) === undefined)
                return `${lowerStorage(stmt.target)} = ${lowerExpr(stmt.value)};`
            else if (isManagedOwnedType(targetType(stmt.target)!))
                return `{ ${lowerType(targetType(stmt.target)!)} oldˇ = ${lowerStorage(stmt.target)}; ${lowerStorage(stmt.target)} = ${lowerConverted(stmt.value, targetType(stmt.target)!)}; releaseRC(oldˇ); }`
            else
                return `${lowerStorage(stmt.target)} = ${lowerConverted(stmt.value, targetType(stmt.target)!)};`
        case 'SELF_INIT':
            return `memcpy(&self->properties, &(${mangleTypeName(stmt.type)}ˇproperties){
                    ${stmt.properties?.map((property) => `.${property.name} = ${lowerPropertyValue(stmt.type, property)}`).join(', ') ?? ''}
                },
                sizeof(${mangleTypeName(stmt.type)}ˇproperties));`
        case 'ENSURE_UNIQUE':
            return `mutateRC(${lowerStorage(stmt.object)});`
        case 'IF': {
            const condition = lowerContainedExpression(stmt.condition)
            const then = lowerBlock(stmt.then, currentReturnType, [])
            const otherwise = stmt.otherwise
                ? ` else {\n${lowerBlock(stmt.otherwise, currentReturnType, [])}\n}`
                : ''
            return `if ((${condition}) == c_true) {\n${then}\n}${otherwise}`
        }
        case 'LOOP': {
            const condition = lowerContainedExpression(stmt.condition)
            const body = lowerBlock(stmt.body, currentReturnType, [])
            return stmt.testAfter
                ? `do {\n${body}\n} while ((${condition}) == c_true);`
                : `while ((${condition}) == c_true) {\n${body}\n}`
        }
        case 'RELEASE':
            return `releaseRC(${lowerStorage(stmt.object)});`
        case 'RETURN': {
            const value = stmt.value
                ? lowerConverted(stmt.value, currentReturnType as cir.ValueSet)
                : undefined
            const { pre, post } = drainTemps()
            const releases = [...blockLocals]
                .reverse()
                .flat()
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
        case 'SCOPE': {
            const savedVariables = variableTypes
            variableTypes = new Map(variableTypes)
            blockLocals.push([])
            try {
                const statements = expr.statements.map(lowerStmt).join('\n')
                const value = lowerContainedExpression(expr.value)
                const result = `scopeˇresult${tempCounter++}`
                const cleanup = expr.cleanup.map(lowerStmt).join('\n')
                const locals = blockLocals[blockLocals.length - 1]
                return `({
                    ${statements}
                    ${lowerType(expr.type)} ${result} = ${value};
                    ${cleanup}
                    ${locals.map((name) => `releaseRC(${name});`).join('\n')}
                    ${result};
                })`
            } finally {
                blockLocals.pop()
                variableTypes = savedVariables
            }
        }
        case 'RETAIN':
            return `retainRC(${lowerStorage(expr.object)})`
        case 'STRING_LITERAL':
            return `String¸fromCString("${expr.type.value}")`
        case 'INTEGER_LITERAL':
            return integerRepresentation(expr.type) === 'native'
                ? expr.type.value
                : `Integer¸fromCString("${expr.type.value}")`
        case 'REAL_LITERAL':
            return lowerRealLiteral(expr)
        case 'TRUTHVALUE_LITERAL':
            return lowerTruthvalueLiteral(expr)
        case 'NOT':
            return `(-(${lowerContainedExpression(expr.operand)}))`
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
                case 'real': {
                    const source = expr.expression.type
                    if (source.universe !== 'real')
                        throw new Error('Only real values can be boxed as real')
                    const representation = realRepresentation(source)
                    return representation === 'managed'
                        ? lowerRealOwned(expr.expression, source)
                        : `Real¸fromBinary(${lowerExpr(expr.expression)}, ${BINARY_FORMATS[representation].bits})`
                }
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
            return `truthvalue¸or(${lowerExpr(expr.left)}, ${lowerExpr(expr.right)})`
        case 'AND':
            return `truthvalue¸and(${lowerExpr(expr.left)}, ${lowerExpr(expr.right)})`
        case 'EQUAL':
            return (
                lowerRealComparison(expr, '==') ??
                lowerIntegerComparison(expr, 'eq', '==') ??
                `((${lowerExpr(expr.left)}) == (${lowerExpr(expr.right)}) ? c_true : c_false)`
            )
        case 'NOT_EQUAL':
            return (
                lowerRealComparison(expr, '!=') ??
                lowerIntegerComparison(expr, 'ne', '!=') ??
                `((${lowerExpr(expr.left)}) != (${lowerExpr(expr.right)}) ? c_true : c_false)`
            )
        case 'LESS_THAN':
            return (
                lowerRealComparison(expr, '<') ??
                lowerIntegerComparison(expr, 'lt', '<') ??
                `((${lowerExpr(expr.left)}) < (${lowerExpr(expr.right)}) ? c_true : c_false)`
            )
        case 'GREATER_THAN':
            return (
                lowerRealComparison(expr, '>') ??
                lowerIntegerComparison(expr, 'gt', '>') ??
                `((${lowerExpr(expr.left)}) > (${lowerExpr(expr.right)}) ? c_true : c_false)`
            )
        case 'LESS_THAN_OR_EQUAL':
            return (
                lowerRealComparison(expr, '<=') ??
                lowerIntegerComparison(expr, 'le', '<=') ??
                `((${lowerExpr(expr.left)}) <= (${lowerExpr(expr.right)}) ? c_true : c_false)`
            )
        case 'GREATER_THAN_OR_EQUAL':
            return (
                lowerRealComparison(expr, '>=') ??
                lowerIntegerComparison(expr, 'ge', '>=') ??
                `((${lowerExpr(expr.left)}) >= (${lowerExpr(expr.right)}) ? c_true : c_false)`
            )
        case 'SAME':
            return `((${lowerExpr(expr.left)}) == (${lowerExpr(expr.right)}) ? c_true : c_false)`
        case 'NOT_SAME':
            return `((${lowerExpr(expr.left)}) != (${lowerExpr(expr.right)}) ? c_true : c_false)`
        case 'ADDITION':
        case 'SUBTRACTION':
        case 'MULTIPLICATION':
        case 'DIVISION':
        case 'REMAINDER':
        case 'POWER':
            return expr.type.universe === 'real'
                ? lowerRealArithmetic(expr)
                : lowerIntegerArithmetic(expr)
        default:
            throw new Error(`Unknown expression kind: ${(expr as any).kind}`)
    }
}

function lowerRealLiteral(
    expr: Extract<cir.Expression, { kind: 'REAL_LITERAL' }>,
): string {
    const precision = expr.type.precision
    if (!precision) throw new Error('Real literal has no explicit precision')
    const value = expr.type.value.replaceAll('_', '')
    const representation = realRepresentation(expr.type)
    return representation === 'managed'
        ? realFromText(value, precision)
        : binaryLiteral(representation, value)
}

function lowerRealArithmetic(
    expr: cir.Expression & { kind: keyof typeof BIG_ARITHMETIC },
): string {
    if (expr.type.universe !== 'real')
        throw new Error('Real arithmetic result must have a real type')
    if (realExpressionRepresentation(expr) === 'managed') {
        const grid = gridCall(expr.type.precision!)
        const functionName = {
            ADDITION: 'add',
            SUBTRACTION: 'subtract',
            MULTIPLICATION: 'multiply',
            DIVISION: 'divide',
            REMAINDER: 'modulus',
            POWER: 'power',
        }[expr.kind]
        const opArgs = grid.suffix === 'Scale' ? grid.args : grid.roundArgs
        return `Real¸${functionName}${grid.suffix}(${lowerRealBorrowed(expr.left, expr.type)}, ${lowerRealBorrowed(expr.right, expr.type)}, ${opArgs})`
    }

    const representation = realExpressionRepresentation(
        expr,
    ) as BinaryRepresentation
    const prefix = BINARY_FORMATS[representation].prefix
    const operation = {
        ADDITION: 'add',
        SUBTRACTION: 'subtract',
        MULTIPLICATION: 'multiply',
        DIVISION: 'divide',
        REMAINDER: 'modulus',
        POWER: 'power',
    }[expr.kind]
    const ctype = BINARY_FORMATS[representation].ctype
    const operand = (e: cir.Expression) => {
        if (e.kind === 'REAL_LITERAL')
            return binaryLiteral(
                representation,
                (e.type as { value: string }).value.replaceAll('_', ''),
            )
        if (e.type.universe === 'real' && isManagedReal(e.type))
            return `(${ctype})Real¸toBinary(${lowerRealExactBorrowed(e)})`
        return `(${ctype})(${lowerExpr(e)})`
    }
    return `${prefix}¸${operation}(${operand(expr.left)}, ${operand(expr.right)})`
}

function lowerRealComparison(
    expr: cir.Expression & { left: cir.Expression; right: cir.Expression },
    operator: '==' | '!=' | '<' | '>' | '<=' | '>=',
): string | undefined {
    if (
        expr.left.type.universe !== 'real' &&
        expr.right.type.universe !== 'real'
    )
        return undefined
    let realType: cir.RealSet
    if (expr.left.type.universe === 'real') realType = expr.left.type
    else if (expr.right.type.universe === 'real') realType = expr.right.type
    else return undefined
    const representation = realRepresentation(realType)
    const bothNative = [expr.left, expr.right].every(
        (e) =>
            e.type.universe === 'real' &&
            realRepresentation(e.type) !== 'managed',
    )
    if (representation !== 'managed' && bothNative)
        return `((${lowerExpr(expr.left)}) ${operator} (${lowerExpr(expr.right)}) ? c_true : c_false)`
    if (
        representation !== 'managed' &&
        expr.left.type.universe !== expr.right.type.universe
    )
        throw new Error(
            'Mixed integer and IEEE real comparison is not supported',
        )

    const left = lowerRealExactBorrowed(expr.left)
    const right = lowerRealExactBorrowed(expr.right)
    const compareOperator =
        operator === '==' ? '==' : operator === '!=' ? '!=' : operator
    return `(Real¸compare(${left}, ${right}) ${compareOperator} 0 ? c_true : c_false)`
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
    REMAINDER: 'modulus',
    POWER: 'power',
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
            case 'REMAINDER':
                return `floorMod64(${l}, ${r})`
            case 'POWER':
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
            receiver
                ? (receiver.object.type as { name: string; namespace?: string })
                : undefined,
        ),
    )
}

function lowerFunctionCall(call: cir.Statement & { kind: 'CALL' }) {
    const receiver = call.receiver
    const builder =
        receiver && isHashBuilder(receiver.object.type)
            ? lowerArgument(receiver.object)
            : undefined
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
            return `${name}(${[builder ?? lowerExpr(receiver.object), ...args].join(', ')})`
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
        case 'conformance': {
            const target = lowerExpr(receiver.object)
            const interfaceName = mangleTypeName(receiver.object.type)
            const slotName = mangleNameWithLabels({
                ...call.name,
                namespace: undefined,
            })
            return `((${interfaceName}ˇwitness *)CONFORMANCE_ENTRY(${target}, ${interfaceName}))->${slotName}(${[target, ...args].join(', ')})`
        }
    }
}

function isHashBuilder(type: cir.ValueSet): boolean {
    return (
        type.universe === 'rc-type' &&
        type.namespace === 'clawr' &&
        type.name === 'HashBuilder'
    )
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
