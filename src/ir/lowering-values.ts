import type { ASTDataLiteral, ASTExpression } from '../ast'
import type {
    SemanticExpression,
    SemanticModule,
    SemanticOwnershipEffects,
} from '../semantic-analyzer'
import type { CExpression } from '.'
import { lowerValueSetType } from './lowering-types'

export function lowerStructLiteralFields(
    module: SemanticModule,
    typeName: string,
    fields: ASTDataLiteral['fields'],
): string {
    const typeDecl = module.types.find((typeDecl) => typeDecl.name === typeName)
    const fieldTypes: Map<string, string> = typeDecl
        ? new Map(
              typeDecl.fields.map((field): [string, string] => [
                  field.name,
                  field.type,
              ]),
          )
        : (() => {
              const objectDecl = module.objects.find(
                  (objectDecl) => objectDecl.name === typeName,
              )
              if (!objectDecl) {
                  throw new Error(
                      `Cannot find type declaration for ${typeName} in struct literal lowering`,
                  )
              }

              const objectByName = new Map(
                  module.objects.map((obj) => [obj.name, obj]),
              )
              const lineage: typeof module.objects = []
              let current: (typeof module.objects)[number] | undefined =
                  objectDecl
              while (current) {
                  lineage.push(current)
                  current = current.supertype
                      ? objectByName.get(current.supertype)
                      : undefined
              }
              lineage.reverse()

              const inheritedFieldTypes = new Map<string, string>()
              for (const declaration of lineage) {
                  const section = declaration.sections.find(
                      (candidate) => candidate.kind === 'data',
                  )
                  for (const field of section?.fields ?? []) {
                      inheritedFieldTypes.set(field.name, field.type)
                  }
              }

              return inheritedFieldTypes
          })()

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
        case 'array-literal':
            throw new Error(
                'Array literals are not supported in struct field literals',
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
        case 'string':
            return {
                kind: 'function-call',
                name: 'String¸fromCString',
                arguments: [{ kind: 'string', value: val.value }],
            }
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
                // For virtual dispatch, preserve the receiver expression (first argument)
                receiver:
                    val.dispatch?.kind === 'virtual' && val.arguments.length > 0
                        ? lowerValue(
                              val.arguments[0].value as Exclude<
                                  SemanticExpression,
                                  ASTDataLiteral
                              >,
                          )
                        : undefined,
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
        case 'binary':
            if (val.operator === '+') {
                if (val.left.kind === 'data-literal') {
                    throw new Error(
                        'String concatenation does not support data-literal lhs',
                    )
                }
                if (val.right.kind === 'data-literal') {
                    throw new Error(
                        'String concatenation does not support data-literal rhs',
                    )
                }

                return {
                    kind: 'function-call',
                    name: 'String¸concat',
                    arguments: [
                        lowerValue(
                            val.left as Exclude<
                                SemanticExpression,
                                ASTDataLiteral
                            >,
                        ),
                        lowerValue(
                            val.right as Exclude<
                                SemanticExpression,
                                ASTDataLiteral
                            >,
                        ),
                    ],
                }
            }

            throw new Error(
                `Unsupported binary operator '${val.operator}' during lowering`,
            )
        case 'array-index':
            if (val.array.kind === 'data-literal') {
                throw new Error('Array index base cannot be data-literal')
            }
            if (val.index.kind !== 'integer') {
                throw new Error(
                    'Array indexing currently requires an integer literal index in lowering',
                )
            }

            return {
                kind: 'raw-expression',
                expression: `ARRAY_ELEMENT_AT_CHECKED(${val.index.value.toString()}, ${renderInlineExpression(lowerValue(val.array as Exclude<SemanticExpression, ASTDataLiteral>))}, ${lowerValueSetType(val.elementType)})`,
            }
        case 'array-literal':
            throw new Error('Array literals are not supported during lowering')
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

function renderInlineExpression(expression: CExpression): string {
    switch (expression.kind) {
        case 'var-ref':
            return expression.name
        case 'string':
            return `"${expression.value}"`
        case 'raw-expression':
            return expression.expression
        case 'function-call':
            return `${expression.name}(${expression.arguments
                .map(renderInlineExpression)
                .join(', ')})`
        case 'field-reference': {
            const object = renderInlineExpression(expression.object)
            return expression.deref
                ? `${object}->${expression.field}`
                : `${object}.${expression.field}`
        }
        case 'struct-init': {
            const fields = Object.entries(expression.fields)
                .map(
                    ([name, value]) =>
                        `. ${name} = ${renderInlineExpression(value)}`,
                )
                .join(', ')
            return `{ ${fields} }`
        }
        default:
            throw new Error(
                `Unsupported inline expression kind '${(expression as never as { kind: string }).kind}'`,
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
