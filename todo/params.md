# Function Parameters — Semantic Model

- Ensure that `valueSet` and `defaultValue` are compatible
- Ensure that `undefined` variables are not modified
- Ensure that `undefined` variables are not assigned without `copy(of:)`

- QUERY/EXEC: Ensure that parameters are passed using compatible semantics
- Allow both `ISOLATED` and `SHARED` values for `undefined` parameters
- Support default parameter values
  - Inject at call site? (only simple values?)
  - Inject as `NULL` and create in body? expressions depending on current state
  - Reference other parameters? Populate in referential order? Expand expressions?
