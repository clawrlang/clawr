# Function Parameters — Semantic Model

- `CallFunc` / `Query` : Check `isolationLevel` and value/lattices of arguments
- `VariableDeclaration.initialValue` may not be an `UNKNOWN` param
- Do not `ENSURE_UNIQUE` a `SHARED` return-value

- Refactoring: improve encapsulation; `Parameter` does nothing

- Ensure that `lattice` and `defaultValue` are compatible
- Ensure that `undefined` variables are not modified
- Ensure that `undefined` variables are not assigned without `copy(of:)`

- CALL: Ensure that each argument matches its parameter’s `isolationLevel`
  - `RETAIN` arguments
- Allow any argument value — `ISOLATED`, `SHARED`, `UNIQUE` and even `UNKNOWN` — for `UNKNOWN` parameters
- Support default parameter values
  - Inject at call site? (only simple values?)
  - Inject as `NULL` and create in body? expressions depending on current state
  - Reference other parameters? Populate in referential order? Expand expressions?
