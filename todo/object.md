# `object`/`service`

- Add `object`/`service` type
- Add `companion` namespace (static methods and fields)
  - Same name as the `object`/`service`
  - Mangle field names as `Type‚field`
- Make `CALL`/`QUERY` support methods
- Allow polymorphic inheritance and `trait` conformance/`role` embodiment
  - inheritance constructor

## Enforce on Frontend

- `object` may not reach outside itself (its fields) except for calling `service` through a parameter
- Can `object` store a service in a field? Let's “no” for now.
- Fields are private (only accessible via `self`)
- `self` is an implicit `ref` variable - mutable but not reassignable
- `data` fields `MUST NOT` have initial values nor be `const`
- fields with initial value should be able to skip value-set
- `companion` with same name as `object`/`service` is added as `companionMethods` in CIR
- `companion` with no matching type is an error
