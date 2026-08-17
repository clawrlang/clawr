import { SourceCodeSpan } from '../diagnostics'
import { Lattice } from './lattice'

export type ExplicitValueSet =
    | {
          lattice?: undefined
          span?: undefined
      }
    | {
          lattice: Lattice
          span: SourceCodeSpan
      }
