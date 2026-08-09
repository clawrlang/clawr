# `object`/`service`

- Parse `{ Super.init() }` data literal
- Dispose `service` (e.g. close file handle) when deallocated

## Enforce on Frontend

- `object` may not reach outside itself (its fields) except for calling `service` through a parameter
- Can `object` store a service in a field? Let's “no” for now.
- Fields are private (only accessible via `self`)
- `self` is an implicit `ref` variable - mutable but not reassignable
- `data` fields `MUST NOT` have initial values nor be `const`
- fields with initial value should be able to skip/infer value-set
- `companion` with same name as `object`/`service` is allowed access to fields and data-literal
- `companion` with no matching type is an error
- Add `object`/`service` type
- Make `CALL` support methods

## Advanced Features (Later)

- Advanced Polymorphism
  - Conformance witness tables
