# Project Planning

## In Progress

- Support `UNIQUE` (`COW`) and `REF` return values
  - `UNIQUE` values are `COW` in the CIR
  - Rewrite semantics to `REF` as needed
  - Returning a `REF` value as `UNIQUE` incurs `copy(of:)`
- Add parameters to `bodyContext.scope`
  - Support `ref`/`-mut` and `const`/`mut` parameters
  - Disallow changes to non-keyword parameters
    - In body, they are `const`
    - To caller, they are `UNIQUE` (but reversed)

## Later

- Generate IDE diagnostics for syntax coloring
  - errors
  - did-you-mean suggestions
  - fixits
- Handle `Integer*` when lowering
  - Add types and ranges to CIR expressions
- Support multi-module programs
  - Allow `@main` in one module only
  - Define library product where `@main {}` is ignored (disallowed?)
- local/anonymous types
  - `data` only?
  - Can it also be a `union`/`enum` type?
- nested functions/closures
- Convert `QUERY` into a statement by assigning to `_`
  - Make `_` a keyword? handle like `self`/`super`
- `object`/`service`
  - Make `CALL`/`QUERY` support methods
  - Enforce on frontend:
    - `object` may not reach outside itself (its fields)
    - Fields are private (only accessible via `self`)
- Replace `copy(of:)` with `{...value}`
  - CIR: `ALLOCATE(fields = {name: FieldReference[]})`

## Feature Template

1. Define Clawr syntax/semantics to support next
2. Add or modify the [Clawr IR types](./src/cir/index.ts)
   1. Employ TDD to build strong unit tests for the backend code
   2. Implement lowering for new/changed IR nodes
   3. Write IR test cases that lower all the way to executables and run them
3. Define syntax that generates the new/existing IR
   1. Employ TDD to build strong unit tests for the frontend code
   2. Implement necessary lexer and parser changes
   3. Implement semantic analysis changes
4. Add end-to-end tests — Clawr source → program output

## Schema Validation

- Publish the schema to a URL and require `$schema` to be that URL
  - Add versioning to the URL
  - Keep loading the schema from dist/cir.schema.json
- When developing, keep `$schema` as generic `string` and use a local path
  - Create a script that replaces `$schema` with the URL for publishing
