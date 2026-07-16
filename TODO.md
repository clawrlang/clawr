# Project Planning

## In Progress

Function Parameters — Semantic Model, `toCIR()`

- Add parameters to `bodyContext.scope`
  - Just add as normal variables (ignore `label`, but use `varName` as name)
  - `undefined` semantics => `const` - (Will `service` affect this? `ref`?)
  - Assigning `undefined` parameter to a variable? Passing it to another function?
    - Require `copy(of:)`?
- `bodyContext()` currently needs the bodyContext to create itself
  - `const inferredLattice = this.implementation.expression.currentValue(context)`
  - If the `expression` references a parameter, that parameter is not added until the `bodyContext` is created
  - Two layers? Add parameters to the child, the `expression` (or `body` statements) to the grandchild?
- Support `ref`/`-mut` and `const`/`mut` parameters
- Support non-keyword parameters as `UNIQUE` (but reversed)
  - To caller, they accept both `COW` and `REF` values
  - In body, they are `const`. Mutation is not allowed except to copies.
- Support default parameter values
  - Inject at call site? (only simple values?)
  - Inject as `NULL` and create in body? expressions depending on current state
  - Reference other parameters? Populate in referential order? Expand expressions?

## Later

- Do the tests perform too much setup?
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
    - `object` may not reach outside itself (its fields) except for calling `service` through a parameter
    - `service` can create background threads and even `fork()` the process
    - Can `object` store a service in a field?
    - Fields are private (only accessible via `self`)
    - `self` is an implicit `ref` variable - mutable but not reassignable
    - Fields may have initial values and be `const`
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
