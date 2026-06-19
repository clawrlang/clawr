# TODO

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
