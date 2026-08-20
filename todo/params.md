# Function Parameters — Semantic Model

- `CallFunc` / `Query`
- `VariableDeclaration.initialValue` may not be an `UNKNOWN` param
- Function return values
  - Do not `ENSURE_UNIQUE` `SHARED` return-value
  - Ensure that value has the right isolation-level

- `toCIR()`
- Refactoring: improve encapsulation; `Parameter` does nothing

- Ensure that `lattice` and `defaultValue` are compatible
- Ensure that `undefined` variables are not modified
- Ensure that `undefined` variables are not assigned without `copy(of:)`

- CALL: Ensure that each argument matches its parameter’s isolation-level
  - `RETAIN` arguments
- Allow any argument value — `ISOLATED`, `SHARED`, `UNIQUE` and even `UNKNOWN` — for `UNKNOWN` parameters
- Support default parameter values
  - Inject at call site? (only simple values?)
  - Inject as `NULL` and create in body? expressions depending on current state
  - Reference other parameters? Populate in referential order? Expand expressions?
