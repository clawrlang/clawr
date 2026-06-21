# Project Planning

## In Progress

First vertical slice

- Implement frontend parsers for…
  - @main body
  - module with @main
- Generate `$main` CIR node
- Write end-to-end test case

## Later Items

- Separate parsing from analysis/conversion
- Allow at most one @main body in the module
- Generate AST for syntax coloring
- Handle `Integer*` when lowering

## Feature Template

1. Define Clawr syntax/semantics to support next
2. Identify and perform needed changes to the [Clawr IR schema](./docs/schema/cir.json)
   1. Employ TDD to build strong unit tests for the backend code
   2. Implement lowering for new/changed IR nodes
   3. Write IR test cases that lower all the way to executables and run them
3. Define syntax that generates the new/existing IR
   1. Employ TDD to build strong unit tests for the frontend code
   2. Implement necessary lexer and parser changes
   3. Implement semantic analysis changes
4. Replace lowering tests with end-to-end tests Clawr source -> frontend -> backend -> run program
