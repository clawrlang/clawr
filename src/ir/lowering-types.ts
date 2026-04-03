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
    switch (type) {
        case 'truthvalue':
            return 'truthvalue_t'
        case 'integer':
            return 'Integer*'
        default:
            return `${type}*`
    }
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
        expression: `(${stmt.name}*)self`,
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
    labels: string[]
    ownerType: string
    visibility: 'public' | 'helper'
    returnType?: string
}

export function lowerObjectStruct(
    objectDecl: ASTObjectDeclaration,
    functionSignatures: Map<string, SemanticFunctionSignature>,
): CStruct[] {
    const dataFields = getObjectDataFields(objectDecl)
    const loweredDataFields = dataFields.map((field) => ({
        name: field.name,
        type: lowerValueSetType(field.type),
    }))

    // Collect all public methods for this object (including inherited)
    const publicMethods = getObjectPublicMethods(
        objectDecl.name,
        functionSignatures,
    )

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
): CStruct | null {
    const publicMethods = getObjectPublicMethods(
        objectDecl.name,
        functionSignatures,
    )

    if (publicMethods.length === 0) return null

    // Create function pointer fields for each public method
    const fields: { name: string; type: string }[] = publicMethods.map(
        (method) => ({
            name: method.name,
            type: `${method.returnType ? lowerValueSetType(method.returnType) : 'void'} (*)(${objectDecl.name}*)`,
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
): CVariableDeclaration | null {
    const publicMethods = getObjectPublicMethods(
        objectDecl.name,
        functionSignatures,
    )

    if (publicMethods.length === 0) return null

    // Create global vtable instance with method pointers
    const methodFields: { [key: string]: CExpression } = {}
    for (const method of publicMethods) {
        // Create a placeholder reference to the actual method implementation
        // In real codegen, this would point to the actual method function pointer
        methodFields[method.name] = {
            kind: 'raw-expression',
            expression: `${objectDecl.name}·${method.name}`,
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
): ObjectMethodInfo[] {
    const methods: ObjectMethodInfo[] = []

    for (const signature of functionSignatures.values()) {
        if (
            signature.ownerType === objectName &&
            signature.visibility === 'public'
        ) {
            methods.push({
                name: signature.name,
                labels: signature.labels,
                ownerType: signature.ownerType,
                visibility: signature.visibility,
                returnType: signature.returnType,
            })
        }
    }

    return methods
}

export function lowerObjectTypeInfo(
    objectDecl: ASTObjectDeclaration,
): CVariableDeclaration {
    const hookNames = structHookNames(objectDecl.name)

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
                            expression: `&${objectDecl.name}ˇvtableInstance`,
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
): CFunctionDeclaration[] {
    const rcFields = getObjectDataFields(objectDecl).filter((field) =>
        isReferenceCountedType(field.type),
    )
    const hooks = structHookNames(objectDecl.name)
    const selfExpr: CExpression = {
        kind: 'raw-expression',
        expression: `(${objectDecl.name}*)self`,
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

function getObjectDataFields(
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

function isReferenceCountedType(type: string): boolean {
    return type !== 'truthvalue'
}
