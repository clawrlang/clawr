# TODO

- Backend: temporaries are hoisted per statement, so `Integer*` temporaries in loop conditions are evaluated only once — hoist them into the loop
- Add `RealLiteral` to the model. (`ter` mode is deferred until real life ternary processors exist — which might be never)
- Lower `real` values on the backend using IEEE `binary*` and `decimal*` representations.
- Lower `real` types with massive precision and/or range as `Real*`.
- Implement static analysis and lowering of dyadic operations supporting combinations of small vs large numbers (`real` and `integer` types).
  - `ADDITION`
  - `SUBTRACTION`
  - `MULTIPLICATION`
  - `DIVISION`
  - `REMAINDER` (can never return negative values - does that affect the type or just the `currentValue`?)
  - `POWER`

## `object`/`service`

- Make 'self' a reserved identifier

### Frontend Semantic/Static Analysis

- Subtype initializers must call a supertype initializer (today it is optional)
- Properties with initial value should be able to skip/infer value-set
- The `currentValue()` is not used for anything anymore. Add some optimizations that use it.

## Function Parameters — Semantic Model

- Refactoring: improve encapsulation; `Parameter` does nothing
  - Ensure that `type` and `defaultValue` are compatible
  - `FunctionCall`: Check `isolationLevel` and value/type of arguments

- Ensure that variables with `undefined` `isolationLevel` are not modified
- Ensure that variables with `undefined` `isolationLevel` are not assigned without `copy(of:)`

- CALL: Ensure that each argument matches its parameter’s `isolationLevel`
- Allow any argument value — `ISOLATED`, `SHARED`, `UNIQUE` and even `UNKNOWN` — for `UNKNOWN` parameters
- Support default parameter values
  - Inject at call site? (only simple values?)
  - Inject as `NULL` and create in body? expressions depending on current state
  - Reference other parameters? Populate in referential order? Expand expressions?

## Advanced / Ice Box

- `object` may not reach outside itself (its properties) except for calling `service` through a parameter
- `VariableDeclaration.initialValue` — handle type mismatch
- `DataLiteral` – handle property type mismatch
- Get the property values from the declared type when converting `SHARED` to `ISOLATED`
  - `SHARED` values cannot know their state
  - `ISOLATED` values can know their state intimately
- binary/ternary data (`tritfield`/`bitfield`)
- should `truthvalue` be `Ordered` – `false < ambiguous < true`?
- Evaluate a (pure) function call.
