import type {
    SemanticDataDeclaration,
    SemanticVariableDeclaration,
    SemanticFunctionSignature,
} from '../semantic-analyzer'
import type { ASTObjectDeclaration } from '../ast'
import type {
    CExpression,
    CFunctionDeclaration,
    CStruct,
    CVariableDeclaration,
} from '.'

export function lowerType(stmt: SemanticVariableDeclaration): string {
    return lowerValueSetType(stmt.valueSet.type)
}

export function lowerValueSetType(type: string): string {
    if (isArrayType(type)) {
        return 'Array*'
    }

    switch (type) {
        case 'truthvalue':
            return 'truthvalue_t'
        case 'integer':
            return 'Integer*'
        case 'string':
            return 'String*'
        default:
            return `${type}*`
    }
}

export function parseArrayElementType(type: string): string | null {
    const match = type.match(/^\[([^\]]+)\]$/)
    return match ? match[1] : null
}

function isArrayType(type: string): boolean {
    return parseArrayElementType(type) !== null
}

export function lowerStruct(stmt: SemanticDataDeclaration): CStruct[] {
    const fields = stmt.fields.map((field) => ({
        name: field.name,
        type: lowerValueSetType(field.type),
    }))

    return [
        {
            kind: 'struct',
            name: stmt.name,
            fields: [{ name: 'header', type: '__rc_header' }, ...fields],
        },
        {
            kind: 'struct',
            name: `${stmt.name}ˇfields`,
            fields,
        },
    ]
}

export function lowerStructTypeInfo(
    stmt: SemanticDataDeclaration,
): CVariableDeclaration {
    const hookNames = structHookNames(stmt.name)

    return {
        kind: 'var-decl',
        type: '__type_info',
        name: `${stmt.name}ˇtype`,
        value: {
            kind: 'struct-init',
            fields: {
                data_type: {
                    kind: 'struct-init',
                    fields: {
                        size: {
                            kind: 'raw-expression',
                            expression: `sizeof(${stmt.name})`,
                        },
                        retain_nested_fields: {
                            kind: 'raw-expression',
                            expression: hookNames.retain,
                        },
                        release_nested_fields: {
                            kind: 'raw-expression',
                            expression: hookNames.release,
                        },
                    },
                },
            },
        },
        modifiers: ['static', 'const'],
    }
}

export function structHookNames(typeName: string): {
    retain: string
    release: string
} {
    return {
        retain: `${typeName}ˇretainNestedFields`,
        release: `${typeName}ˇreleaseNestedFields`,
    }
}

export function lowerStructHooks(
    stmt: SemanticDataDeclaration,
): CFunctionDeclaration[] {
    const rcFields = stmt.fields.filter((field) => field.isReferenceCounted)
    const hooks = structHookNames(stmt.name)
    const selfExpr: CExpression = {
        kind: 'raw-expression',
        expression: `((${stmt.name}*)self)`,
    }

    return [
        {
            kind: 'function',
            name: hooks.retain,
            returnType: 'void',
            parameters: [{ name: 'self', type: 'void*' }],
            body: rcFields.map((field) => ({
                kind: 'function-call',
                name: 'retainRC',
                arguments: [
                    {
                        kind: 'field-reference',
                        object: selfExpr,
                        field: field.name,
                        deref: true,
                    },
                ],
            })),
        },
        {
            kind: 'function',
            name: hooks.release,
            returnType: 'void',
            parameters: [{ name: 'self', type: 'void*' }],
            body: rcFields.map((field) => ({
                kind: 'function-call',
                name: 'releaseRC',
                arguments: [
                    {
                        kind: 'field-reference',
                        object: selfExpr,
                        field: field.name,
                        deref: true,
                    },
                ],
            })),
        },
    ]
}

// ---- Object lowering ----

export interface ObjectMethodInfo {
    name: string
    slotName: string
    labels: string[]
    ownerType: string
    visibility: 'public' | 'helper'
    returnType?: string
    parameterTypes: string[]
}

export function lowerObjectStruct(
    objectDecl: ASTObjectDeclaration,
    functionSignatures: Map<string, SemanticFunctionSignature>,
    objects: ASTObjectDeclaration[],
): CStruct[] {
    const dataFields = getObjectAllDataFields(objectDecl, objects)
    const loweredDataFields = dataFields.map((field) => ({
        name: field.name,
        type: lowerValueSetType(field.type),
    }))

    return [
        {
            kind: 'struct',
            name: objectDecl.name,
            fields: [
                { name: 'header', type: '__rc_header' },
                ...loweredDataFields,
            ],
        },
        {
            kind: 'struct',
            name: `${objectDecl.name}ˇfields`,
            fields: loweredDataFields,
        },
    ]
}

export function lowerObjectVtable(
    objectDecl: ASTObjectDeclaration,
    functionSignatures: Map<string, SemanticFunctionSignature>,
    objects: ASTObjectDeclaration[],
): CStruct | null {
    const publicMethods = getObjectPublicMethods(
        objectDecl.name,
        functionSignatures,
        objects,
    )

    if (publicMethods.length === 0) return null

    // Create function pointer fields for each public method
    const fields: { name: string; type: string }[] = publicMethods.map(
        (method) => ({
            name: method.slotName,
            type: `${method.returnType ? lowerValueSetType(method.returnType) : 'void'} (*)(${[
                `${method.ownerType}*`,
                ...method.parameterTypes.map((type) => lowerValueSetType(type)),
            ].join(', ')})`,
        }),
    )

    return {
        kind: 'struct',
        name: `${objectDecl.name}ˇvtable`,
        fields,
    }
}

export function lowerObjectVtableInstance(
    objectDecl: ASTObjectDeclaration,
    functionSignatures: Map<string, SemanticFunctionSignature>,
    objects: ASTObjectDeclaration[],
): CVariableDeclaration | null {
    const publicMethods = getObjectPublicMethods(
        objectDecl.name,
        functionSignatures,
        objects,
    )

    if (publicMethods.length === 0) return null

    // Create global vtable instance with method pointers
    const methodFields: { [key: string]: CExpression } = {}
    for (const method of publicMethods) {
        // Create a placeholder reference to the actual method implementation
        // In real codegen, this would point to the actual method function pointer
        methodFields[method.slotName] = {
            kind: 'raw-expression',
            expression: `${method.ownerType}·${method.slotName}`,
        }
    }

    return {
        kind: 'var-decl',
        type: `${objectDecl.name}ˇvtable`,
        name: `${objectDecl.name}ˇvtableInstance`,
        value: {
            kind: 'struct-init',
            fields: methodFields,
        },
        modifiers: ['static', 'const'],
    }
}

function getObjectPublicMethods(
    objectName: string,
    functionSignatures: Map<string, SemanticFunctionSignature>,
    objects: ASTObjectDeclaration[],
): ObjectMethodInfo[] {
    const methodsBySlot = new Map<string, ObjectMethodInfo>()
    const objectByName = new Map(objects.map((obj) => [obj.name, obj]))
    const lineage: string[] = []

    let currentName: string | undefined = objectName
    while (currentName) {
        lineage.push(currentName)
        currentName = objectByName.get(currentName)?.supertype
    }

    lineage.reverse()

    for (const ownerType of lineage) {
        for (const signature of functionSignatures.values()) {
            if (signature.ownerType !== ownerType) continue
            if (signature.visibility !== 'public') continue

            const slotKey = `${signature.name}::${signature.labels.join('|')}`
            methodsBySlot.set(slotKey, {
                name: signature.name,
                slotName: mangleCallableName(signature.name, signature.labels),
                labels: signature.labels,
                ownerType: signature.ownerType,
                visibility: signature.visibility,
                returnType: signature.returnType,
                parameterTypes: signature.parameterTypes,
            })
        }
    }

    return [...methodsBySlot.values()]
}

export function lowerObjectTypeInfo(
    objectDecl: ASTObjectDeclaration,
    functionSignatures: Map<string, SemanticFunctionSignature>,
    objects: ASTObjectDeclaration[],
): CVariableDeclaration {
    const hookNames = structHookNames(objectDecl.name)
    const hasPublicMethods =
        getObjectPublicMethods(objectDecl.name, functionSignatures, objects)
            .length > 0

    return {
        kind: 'var-decl',
        type: '__type_info',
        name: `${objectDecl.name}ˇtype`,
        value: {
            kind: 'struct-init',
            fields: {
                polymorphic_type: {
                    kind: 'struct-init',
                    fields: {
                        data: {
                            kind: 'struct-init',
                            fields: {
                                size: {
                                    kind: 'raw-expression',
                                    expression: `sizeof(${objectDecl.name})`,
                                },
                                retain_nested_fields: {
                                    kind: 'raw-expression',
                                    expression: hookNames.retain,
                                },
                                release_nested_fields: {
                                    kind: 'raw-expression',
                                    expression: hookNames.release,
                                },
                            },
                        },
                        super: {
                            kind: 'raw-expression',
                            expression: objectDecl.supertype
                                ? `&${objectDecl.supertype}ˇtype.polymorphic_type`
                                : 'NULL',
                        },
                        vtable: {
                            kind: 'raw-expression',
                            expression: hasPublicMethods
                                ? `&${objectDecl.name}ˇvtableInstance`
                                : 'NULL',
                        },
                    },
                },
            },
        },
        modifiers: ['static', 'const'],
    }
}

export function lowerObjectHooks(
    objectDecl: ASTObjectDeclaration,
    objects: ASTObjectDeclaration[],
): CFunctionDeclaration[] {
    const rcFields = getObjectAllDataFields(objectDecl, objects).filter(
        (field) => isReferenceCountedType(field.type),
    )
    const hooks = structHookNames(objectDecl.name)
    const selfExpr: CExpression = {
        kind: 'raw-expression',
        expression: `((${objectDecl.name}*)self)`,
    }

    return [
        {
            kind: 'function',
            name: hooks.retain,
            returnType: 'void',
            parameters: [{ name: 'self', type: 'void*' }],
            body: rcFields.map((field) => ({
                kind: 'function-call',
                name: 'retainRC',
                arguments: [
                    {
                        kind: 'field-reference',
                        object: selfExpr,
                        field: field.name,
                        deref: true,
                    },
                ],
            })),
        },
        {
            kind: 'function',
            name: hooks.release,
            returnType: 'void',
            parameters: [{ name: 'self', type: 'void*' }],
            body: rcFields.map((field) => ({
                kind: 'function-call',
                name: 'releaseRC',
                arguments: [
                    {
                        kind: 'field-reference',
                        object: selfExpr,
                        field: field.name,
                        deref: true,
                    },
                ],
            })),
        },
    ]
}

function getObjectOwnDataFields(
    objectDecl: ASTObjectDeclaration,
): ASTObjectDeclaration['sections'][number] extends infer S
    ? S extends { kind: 'data'; fields: infer F }
        ? F extends Array<infer Field>
            ? Field[]
            : never
        : never
    : never {
    const dataSection = objectDecl.sections.find(
        (section): section is Extract<typeof section, { kind: 'data' }> =>
            section.kind === 'data',
    )
    return (dataSection?.fields ?? []) as any
}

function getObjectAllDataFields(
    objectDecl: ASTObjectDeclaration,
    objects: ASTObjectDeclaration[],
): Array<{ name: string; type: string }> {
    const objectByName = new Map(objects.map((obj) => [obj.name, obj]))
    const lineage: ASTObjectDeclaration[] = []

    let current: ASTObjectDeclaration | undefined = objectDecl
    while (current) {
        lineage.push(current)
        current = current.supertype
            ? objectByName.get(current.supertype)
            : undefined
    }

    lineage.reverse()

    const fieldsByName = new Map<string, { name: string; type: string }>()
    for (const declaration of lineage) {
        for (const field of getObjectOwnDataFields(declaration)) {
            fieldsByName.set(field.name, {
                name: field.name,
                type: field.type,
            })
        }
    }

    return [...fieldsByName.values()]
}

function isReferenceCountedType(type: string): boolean {
    return type !== 'truthvalue'
}

function mangleCallableName(name: string, labels: string[]): string {
    const suffix = labels
        .filter((label) => label !== '_')
        .map((label) => `__${label}`)
        .join('')
    return `${name}${suffix}`
}
