# TODO

## Documentation

- ADR-012 and ADR-013 contradict each other according to clawr-doc/spec/language/semantics/function-parameters.md. The desired behavior is that labels can be reordered in the source code. But this is probably not reflected in the CIR. There is an idea regarding currying, where labelled arguments can be partially applied. It does not seem to be documented anywhere yet.

## `object`/`service`

- Make `self` a reserved identifier (and `super` too?)

### Frontend Semantic/Static Analysis

- Subtype initializers must call a supertype initializer (today it is optional)
- Properties with initial value should be able to skip/infer value-set
- The `currentValue()` is not used for anything anymore. Add some optimizations that use it.
  - The `currentValue()` could be used to allow an operation like `a^b` even if the `type` of `b` includes negative values.

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

- Add a language-level `toFraction` operation for the existing runtime functionality.
- `object` may not reach outside itself (its properties) except for calling `service` through a parameter
- `VariableDeclaration.initialValue` — handle type mismatch
- `DataLiteral` – handle property type mismatch
- Get the property values from the declared type when converting `SHARED` to `ISOLATED`
  - `SHARED` values cannot know their state
  - `ISOLATED` values can know their state intimately
- binary/ternary data (`tritfield`/`bitfield`)
- should `truthvalue` be `Ordered` – `false < ambiguous < true`?
- Evaluate a (pure) function call.
- Backend: temporaries are hoisted per statement, so `Integer*` temporaries in loop conditions are evaluated only once — hoist them into the loop
