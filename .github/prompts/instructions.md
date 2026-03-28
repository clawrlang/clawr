# Instructions

The product is a compiler. It should be modular and separate frontend (lexer+parser) from backend (lowering+codegen). There might be more modules/pipeline stages added later (such as semantic analysis and optimisation).

The preferred workflow is to “pull” functionality from runtime via lowering, to frontend.

1. Plan a vertical slice (syntax and semantics)
2. Design and implement the C code to execute at runtime (if it isn't already implemented)
3. Design the IR and implement codegen that emits the needed C code
4. Design the AST and implement the lowering from AST to IR
5. Design the Clawr syntax and implement lexer and parser code to generate the needed AST

Each of the above steps should be planned individually. Do not execute all in one sweep.

## Testing Configuration

This repository uses Bun to run tests. But Bun is not installed globally. Use `npx bun test` to run specific test suites.

`npm test` runs only quick unit tests.

`npm: run test:runtime` runs runtime tests. They are slow because each test case is a program that has to be compiled (using clang).

`npm run test:all` runs all tests, including E2E tests (tests/e2e/cases) _and_ runtime tests (tests/runtime/cases).

## Object-Oriented design

Prefer an object-oriented design, at least for stateful code. Pure functions and expressions are however better than stateful code.
