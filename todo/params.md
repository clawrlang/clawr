# Function Parameters — Semantic Model

- `FunctionDeclaration`
- `CallFunc` / `Query`
- `ReturnStatement`
- `Assignment.target` may not be a `default`-param
- `Assignment.value` may not be a `default`-param nor a field on one
  - `default` works as `const` in `isEffectivelyConst`
- `VariableDeclaration.initialValue` may not be a `default`-param

- Ensure that `valueSet` and `defaultValue` are compatible
- Ensure that `undefined` variables are not modified
- Ensure that `undefined` variables are not assigned without `copy(of:)`

- CALL: Ensure that parameters are passed using compatible semantics
- Allow both `ISOLATED` and `SHARED` values for `undefined` parameters
- Support default parameter values
  - Inject at call site? (only simple values?)
  - Inject as `NULL` and create in body? expressions depending on current state
  - Reference other parameters? Populate in referential order? Expand expressions?
