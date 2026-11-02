# TODO

- Complete `real` lowering with finite precision, per-operation rounding, and a magnitude range limited only by available memory; fixed-exponent IEEE formats alone are insufficient.
  - Implemented initial slice: decimal `Real*` values with explicit precision and arbitrary decimal exponents, plus bounded IEEE binary16/binary32/binary64 lowering, arbitrary-precision binary reals (`Real*` rounded to N bits) for any other `sig N bin` or non-full range, `sig N ter` stored as binary with 1 + ⌈N·log₂3⌉ bits (ADR-025), and integer arithmetic with decimal `sig`/`scale` reals.
  - Covered end to end by `packages/rwrc/test/cases/real-*.clawr` (`.panic` files assert expected runtime aborts).
  - Remaining: `scale` precision in base 2 and 3, conversions between native IEEE and arbitrary-precision binary reals, real remainder, fractional real exponents, named `float32`/`float64` types, and real values returned from functions (blocked by the same ISOLATED/UNIQUE return rule as integers).
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
- Backend: temporaries are hoisted per statement, so `Integer*` temporaries in loop conditions are evaluated only once — hoist them into the loop
