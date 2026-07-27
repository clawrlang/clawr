# `object`/`service`

```clawr
object Super {
  func field() => self.field
mutating:
  func setField(_ value: integer) {
    self.field = value
  }
inheritance:
  func constructAsSuper(field: integer) => { field }
data:
  field: integer
}

object Sub: Super {}
companion Sub {
  func new(field: integer) => { Super.constructAsSuper(field: field) }
}

// Always `ref` (mutable, not COW). No need for `mutating:` section
service S {
  func read() => loadFile(FILE)
  func write(value: string) {}
inheritance:
data:
  stateField: integer
}
```

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
- `companion` with same name as `object`/`service` is added as `companionMethods` in CIR
- `companion` with no matching type is an error
