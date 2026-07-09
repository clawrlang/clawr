import { SourceCodeSpan } from '../diagnostics'

export type ValueSet =
    | {
          type: 'integer'
          min?: bigint
          max?: bigint
          span: SourceCodeSpan
      }
    | {
          type: 'truthvalue'
          values?: ('false' | 'ambiguous' | 'true')[]
          span: SourceCodeSpan
      }
    | {
          type: 'string'
          span: SourceCodeSpan
      }
    | {
          type: 'rc-type'
          typeName: string
          span: SourceCodeSpan
      }
