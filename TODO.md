# TODO

- Backend: temporaries are hoisted per statement, so `Integer*` temporaries in loop conditions are evaluated only once — hoist them into the loop
- `real` operands — deferred until [ADR-025](adr/adr-025.md) settles precision and whether `Real*` is used

## `object`/`service`

- Parse `trait`/`role` types (method signatures without body)
- Begin static analysis for `object`/`service`/`trait`/`role`
- Make 'self' a reserved identifier
- Make `FunctionCall` support methods
  - [x] direct
  - [x] inherited
  - [ ] conformance

### Frontend Semantic/Static Analysis

- Subtype initializers must call a supertype initializer (today it is optional)
- Can `object` store a service in a property? Let's “no” for now.
- Properties are private (only accessible via `self`) — but `data` properties `MUST NOT` be private!
- `data` properties `MUST NOT` have initial values nor be `const`
- Properties with initial value should be able to skip/infer value-set

## Function Parameters — Semantic Model

- Do not `ENSURE_UNIQUE` a `SHARED` return-value

- Refactoring: improve encapsulation; `Parameter` does nothing
  - Ensure that `type` and `defaultValue` are compatible
  - `FunctionCall`: Check `isolationLevel` and value/type of arguments

- Ensure that variables with `undefined` `isolationLevel` are not modified
- Ensure that variables with `undefined` `isolationLevel` are not assigned without `copy(of:)`

- CALL: Ensure that each argument matches its parameter’s `isolationLevel`
  - `RETAIN` arguments
- Allow any argument value — `ISOLATED`, `SHARED`, `UNIQUE` and even `UNKNOWN` — for `UNKNOWN` parameters
- Support default parameter values
  - Inject at call site? (only simple values?)
  - Inject as `NULL` and create in body? expressions depending on current state
  - Reference other parameters? Populate in referential order? Expand expressions?

## Advanced / Ice Box

- `object` may not reach outside itself (its properties) except for calling `service` through a parameter
- `FunctionCall.type()` should probably not return `currentValue()`
- `VariableDeclaration.initialValue` — handle type mismatch
- `DataLiteral` – handle property type mismatch
- Get the property values from the declared type when converting `SHARED` to `ISOLATED`
  - `SHARED` values cannot know their state
  - `ISOLATED` values can know their state intimately
- binary/ternary data (`tritfield`/`bitfield`)
- should `truthvalue` be `Ordered` – `false < ambiguous < true`?
- Evaluate a (pure) function call.
