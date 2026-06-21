# Project Planning

## In Progress

- Implement frontend parsers for…
  - truthvalue literal
  - integer literal
  - string literal
  - function call
  - @main body
  - simple module
- Write end-to-end test cases:

  ```clawr
  @main {
      printTruthValue(true)
  }
  ```

  ```clawr
  @main {
      printInteger(1)
  }
  ```

## TODO Items

- First vertical slice
  - Parse `TruthvalueLiteral` expression
  - Parse `IntegerLiteral` expression
  - Parse `RealLiteral` expression
  - Parse `print()` statement
  - Generate `INTEGER_LITERAL` AST node for lowering
  - Generate `INTEGER_LITERAL` AST node for syntax coloring
  - Generate `FUNCTION_CALL` AST node for lowering
  - Generate `FUNCTION_CALL` AST node for syntax coloring
  - Lower literals to C-IR
    - `c_false`, `c_ambiguous`, `c_true`
    - `int64_t` (postpone arbitrary precision until later)
    - `double`
  - Lower `FUNCTION_CALL` to C-IR
  - Lower literals to C code
  - Lower `FUNCTION_CALL` to C code
  - Compile C code using Clang
  - Add test cases

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
