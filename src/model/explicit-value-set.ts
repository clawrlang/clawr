import { SourceCodeSpan } from '../diagnostics'
import { AnyIsolationLevel } from './isolation-level'
import { Lattice } from './lattice'

export type ExplicitValueSet<IsolationLevel extends AnyIsolationLevel> =
    | {
          isolationLevel: IsolationLevel
          lattice?: undefined
          span?: undefined
      }
    | {
          isolationLevel: IsolationLevel
          lattice: Lattice
          span: SourceCodeSpan
      }
