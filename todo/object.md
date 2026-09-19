# `object`/`service`

- Make 'self' a reserved identifier
- Remove `companion` (ADR-019, ADR-020). It is not used yet anyway
  - `CompanionParser` is still in its test-fixture module
- Make `FunctionCall` support methods
  - direct
  - inherited
  - conformance

## Frontend Semantic/Static Analysis

- `superType` matches initializer call
  - No `superType` => no initializer
  - `superType` must equal initializer `target`
- Can `object` store a service in a field? Let's “no” for now.
- Fields are private (only accessible via `self`) — but `data` fields `MUST NOT` be private!
- `data` fields `MUST NOT` have initial values nor be `const`
- fields with initial value should be able to skip/infer value-set

## Advanced

- `object` may not reach outside itself (its fields) except for calling `service` through a parameter
