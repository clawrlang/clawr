# Project Planning

## In Progress

- Get the fields from the default set when converting SHARED to UNIQUE
- `FunctionName` lacks namespace
  - DataDeclParser
  - ValueSetParser
  - RCTypeLattice
- `ReturnStatement.emitStatement` is never called with `semantics`
  - Add called function to scope/context?

## Incomplete/Postponed Functionality

- [Function Parameters](./todo/params.md)
  - `toCIR()`
  - Refactoring: improve encapsulation; `Parameter` does nothing
- `VariableDeclaration` `initialValue` type mismatch
- `DataLiteral` field type mismatch
- [Object](./todo/object.md)
