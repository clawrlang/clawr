# `object`/`service`

```clawr
object O {
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

object Sub {}
companion Sub {
  func new(field: integer) => { O.constructAsSuper(field: field) }
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
  - Lowering similar to `data`
  - Mangle method names as `Type·method`
- Add `companion` namespace (static methods and fields)
  - Same name as the `object`/`service`
  - Mangle method base names as `Type¸staticMethod`
  - Mangle field names as `Type‚field`
- Make `CALL`/`QUERY` support methods

## Enforce on Frontend

- `object` may not reach outside itself (its fields) except for calling `service` through a parameter
- `service` can create background threads and even `fork()` the process
- Can `object` store a service in a field? Let's “no” for now.
- Fields are private (only accessible via `self`)
- `self` is an implicit `ref` variable - mutable but not reassignable
- Fields may have initial values and be `const`
- `companion` must have the same name as an `object`/`service`
