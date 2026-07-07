export type ClawrModule = {
    $schema: 'http://clawr.lang/schema/cir/DRAFT-0' | 'cir.schema.json'
    startBlock?: Statement[]
    declarations?: Declaration[]
}

export type Declaration =
    | {
          kind: 'VARIABLE_DECL'
          name: string
          valueSet: ValueSet
          initialValue: Expression
      }
    | {
          kind: 'DATA_DECL'
          name: string
          fields: {
              name: string
              valueSet: ValueSet
          }[]
      }

export type Statement =
    | {
          kind: 'ENSURE_UNIQUE'
          object: Expression
      }
    | {
          kind: 'RELEASE'
          object: Extract<
              Expression,
              { kind: 'VARIABLE_REF' | 'FIELD_REF'; valueSet?: ValueSet }
          >
      }
    | {
          kind: 'CALL_FUNC'
          signature: {
              baseName: string
              parameters: {
                  label?: string
                  type: string
              }[]
          }
          arguments: Expression[]
      }
    | Extract<Declaration, { kind: 'VARIABLE_DECL' }>
    | {
          kind: 'ASSIGN'
          target: Extract<Expression, { kind: 'VARIABLE_REF' | 'FIELD_REF' }>
          value: Expression
      }

export type Expression =
    | {
          kind: 'STRING_LITERAL'
          value: string
          valueSet: Extract<ValueSet, { type: 'string' }>
      }
    | {
          kind: 'INTEGER_LITERAL'
          value: string
          valueSet: Extract<ValueSet, { type: 'integer' }>
      }
    | {
          kind: 'TRUTHVALUE_LITERAL'
          value: 'false' | 'ambiguous' | 'true'
          valueSet: Extract<ValueSet, { type: 'truthvalue' }>
      }
    | {
          kind: 'ALLOCATE'
          valueSet: Extract<ValueSet, { type: 'rc-type' }>
          fields: {
              name: string
              value: Expression
          }[]
      }
    | {
          kind: 'RETAIN'
          object: Extract<Expression, { kind: 'VARIABLE_REF' | 'FIELD_REF' }>
          valueSet: Extract<ValueSet, { type: 'rc-type' }>
      }
    | {
          kind: 'VARIABLE_REF'
          name: string
          valueSet: ValueSet
      }
    | {
          kind: 'FIELD_REF'
          object: Expression
          field: string
          valueSet: ValueSet
      }
    | (Extract<Statement, { kind: 'CALL_FUNC' }> & { valueSet: ValueSet })

export type ValueSet =
    | {
          type: 'integer'
          min?: string
          max?: string
      }
    | {
          type: 'truthvalue'
          values?: ('false' | 'ambiguous' | 'true')[]
      }
    | {
          type: 'string'
      }
    | {
          type: 'rc-type'
          typeName: string
          semantics: 'REF' | 'COW' | 'UNIQUE'
          fields?: {
              name: string
              valueSet: ValueSet
          }[]
      }
