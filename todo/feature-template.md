# Feature Template

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

## Compact Version

- Add or modify the [Clawr IR types](./src/cir/index.ts)
- Implement lowering for new/changed IR nodes
- Implement necessary lexer and parser changes
- Implement semantic analysis changes
