export type ClawrModule = {
    $schema: 'http://clawr.lang/schema/cir/DRAFT-0'
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
      }
    | {
          kind: 'INTEGER_LITERAL'
          value: string
      }
    | {
          kind: 'TRUTHVALUE_LITERAL'
          value: 'false' | 'ambiguous' | 'true'
      }
    | {
          kind: 'ALLOCATE'
          type: string
          semantics: 'REF' | 'COW'
          fields: {
              name: string
              value: Expression
          }[]
      }
    | {
          kind: 'RETAIN'
          object: Extract<Expression, { kind: 'VARIABLE_REF' | 'FIELD_REF' }>
      }
    | {
          kind: 'VARIABLE_REF'
          name: string
      }
    | {
          kind: 'FIELD_REF'
          object: Expression
          field: string
      }
    | Extract<Statement, { kind: 'CALL_FUNC' }>

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
      }
