# Traits and Roles

Similar to `role`, but can be `ISOLATED`.

- Keyword `trait`
  - Applies to `object` and `data` (through an `extension`)
  - `SHARED` or `ISOLATED`
- Keyword `role`
  - applies to `service`, but can also be implemented by `object`
  - `SHARED` only
- Add `trait`s to std library (see <https://github.com/clawrlang/clawr-doc/blob/main/api-reference/std-lib.md>)
  - `Equatable`
  - `HashEquatable`
  - `HasStringRepresentation`
  - `Identifiable`
  - `Ordered`
  - more?
  - Create a std-lib first
