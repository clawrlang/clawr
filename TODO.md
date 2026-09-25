# TODO

- Parse `trait`/`role` types (method signatures without body)
- Begin static analysis for `object`/`service`/`trait`/`role`

## `object`/`service`

- Make 'self' a reserved identifier
- Make `FunctionCall` support methods
  - [x] direct
  - inherited
  - conformance

### Frontend Semantic/Static Analysis

- `superType` matches initializer call
  - No `superType` => no initializer
  - `superType` must equal initializer `target`
- Can `object` store a service in a field? Let's “no” for now.
- Fields are private (only accessible via `self`) — but `data` fields `MUST NOT` be private!
- `data` fields `MUST NOT` have initial values nor be `const`
- fields with initial value should be able to skip/infer value-set

## Traits in stdlib

- `Equatable`
- `HashEquatable`
- `HasStringRepresentation`
- `Identifiable`
- `Ordered`

## Function Parameters — Semantic Model

- Do not `ENSURE_UNIQUE` a `SHARED` return-value

- Refactoring: improve encapsulation; `Parameter` does nothing
  - Ensure that `domain` and `defaultValue` are compatible
  - `FunctionCall`: Check `isolationLevel` and value/domains of arguments

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

- `object` may not reach outside itself (its fields) except for calling `service` through a parameter
- `FunctionCall.domain()` should probably not return `currentValue()`
- `VariableDeclaration.initialValue` — handle type mismatch
- `DataLiteral` – handle field type mismatch
- Get the field values from the declared domain when converting `SHARED` to `ISOLATED`
  - `SHARED` values cannot know their state
  - `ISOLATED` values can know their state intimately
