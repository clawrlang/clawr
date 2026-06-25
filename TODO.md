# Project Planning

## In Progress

## Next

- Add reference-counting to `data`
  - Add `__rc_header` to `struct` (see [datastructure.h](tests/runtime/cases/data_structure.h))
  - Lower as `ˇfields` (see [copy-on-write.h](tests/runtime/cases/copy-on-write.c))
  - `ALLOC(Type, COW|REF)`
  - `ASSIGN_FIELDS`
  - `ENSURE_UNIQUE` before editing if `COW`
  - `RELEASE` on descope
- Infer variable types / value-sets
- Nested scopes (global/local vars)
- Generate AST for syntax coloring

## Later

- Handle `Integer*` when lowering
- Support multi-module programs
  - Allow `@main` in one module only
  - Define library product where `@main {}` is ignored (disallowed?)
- local/anonymous types
- nested functions/closures

## Feature Template

1. Define Clawr syntax/semantics to support next
2. Identify and perform needed changes to the [Clawr IR schema](./docs/schema/cir.schema.json)
   1. Employ TDD to build strong unit tests for the backend code
   2. Implement lowering for new/changed IR nodes
   3. Write IR test cases that lower all the way to executables and run them
3. Define syntax that generates the new/existing IR
   1. Employ TDD to build strong unit tests for the frontend code
   2. Implement necessary lexer and parser changes
   3. Implement semantic analysis changes
4. Add end-to-end tests — Clawr source → program output
