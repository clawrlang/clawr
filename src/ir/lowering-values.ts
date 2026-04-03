import type { ASTDataLiteral, ASTExpression } from '../ast'
import type {
    SemanticExpression,
    SemanticModule,
    SemanticOwnershipEffects,
} from '../semantic-analyzer'
import type { CExpression } from '.'

export function lowerStructLiteralFields(
    module: SemanticModule,
    typeName: string,
    fields: ASTDataLiteral['fields'],
): string {
    const typeDecl = module.types.find((typeDecl) => typeDecl.name === typeName)
    if (!typeDecl) {
        throw new Error(
            `Cannot find type declaration for ${typeName} in struct literal lowering`,
        )
    }

    const fieldTypes = new Map(
        typeDecl.fields.map((field) => [field.name, field.type]),
    )

    return Object.entries(fields)
        .map(([fieldName, expr]) => {
            const fieldType = fieldTypes.get(fieldName)
            if (!fieldType) {
                throw new Error(
                    `Field ${fieldName} not found in type ${typeName}`,
                )
            }

            const lowered = lowerStructFieldExpression(module, expr, fieldType)
            return `.${fieldName} = ${lowered}`
        })
        .join(', ')
}

export function lowerStructFieldExpression(
    module: SemanticModule,
    expr: ASTExpression,
    declaredFieldType: string,
): string {
    switch (expr.kind) {
        case 'truthvalue':
            return `c_${expr.value}`
        case 'integer':
            return `Integer¸fromCString("${expr.value.toString()}")`
        case 'call':
            throw new Error(
                'Call expressions are not supported in struct field literals',
            )
        case 'identifier':
            return expr.name
        case 'data-literal':
            return `&(${declaredFieldType}ˇfields){ ${lowerStructLiteralFields(module, declaredFieldType, expr.fields)} }`
        case 'binary':
            throw new Error(
                'Binary expressions are not supported in struct field literals',
            )
        case 'copy':
            throw new Error('copy(...) is unsupported in struct field literals')
        default:
            throw new Error(
                `Unsupported struct field expression kind: ${(expr as never as { kind: string }).kind}`,
            )
    }
}

export function lowerValue(
    val: Exclude<SemanticExpression, ASTDataLiteral>,
): CExpression {
    switch (val.kind) {
        case 'integer':
            return {
                kind: 'function-call',
                name: 'Integer¸fromCString',
                arguments: [{ kind: 'string', value: val.value.toString() }],
            }
        case 'truthvalue':
            return { kind: 'var-ref', name: `c_${val.value}` }
        case 'identifier':
            return { kind: 'var-ref', name: val.name }
        case 'call':
            return {
                kind: 'function-call',
                name: mangleCallName(val.callee, val.arguments),
                dispatch: val.dispatch,
                arguments: val.arguments.map((arg) => {
                    if (arg.value.kind === 'data-literal') {
                        throw new Error(
                            'Data-literal call arguments are unsupported for now',
                        )
                    }
                    return lowerValue(arg.value)
                }),
            }
        case 'field-access':
            return {
                kind: 'field-reference',
                object: lowerValue(
                    val.object as Exclude<SemanticExpression, ASTDataLiteral>,
                ),
                field: val.field,
                deref: true,
            }
        case 'copy':
            if (val.value.kind === 'data-literal') {
                throw new Error('copy(...) of data literal is unsupported')
            }
            return lowerValue(
                val.value as Exclude<SemanticExpression, ASTDataLiteral>,
            )
        default:
            throw new Error(
                `Unknown AST value kind ${(val as never as { kind: string }).kind}`,
            )
    }
}

export function lowerOwnedValue(
    val: Exclude<SemanticExpression, ASTDataLiteral>,
    ownership: SemanticOwnershipEffects,
): CExpression {
    const lowered = lowerValue(val)
    if (!ownership.copyValueSemantics) return lowered

    return {
        kind: 'function-call',
        name: 'copyRC',
        arguments: [
            lowered,
            { kind: 'var-ref', name: ownership.copyValueSemantics },
        ],
    }
}

function extractCallName(callee: SemanticExpression): string {
    if (callee.kind === 'identifier') return callee.name
    throw new Error(`Unsupported call callee kind '${callee.kind}'`)
}

function mangleCallName(
    callee: SemanticExpression,
    arguments_: Extract<SemanticExpression, { kind: 'call' }>['arguments'],
): string {
    const base = extractCallName(callee)
    const suffix = arguments_
        .map((arg) => arg.label)
        .filter((label): label is string => Boolean(label && label !== '_'))
        .map((label) => `__${label}`)
        .join('')

    return `${base}${suffix}`
}
