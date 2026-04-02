import type {
    SemanticDataDeclaration,
    SemanticVariableDeclaration,
} from '../semantic-analyzer'
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

export function isReferenceCountedValueSetType(type: string): boolean {
    return type !== 'truthvalue'
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
    const rcFields = stmt.fields.filter((field) =>
        isReferenceCountedValueSetType(field.type),
    )
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
