# Ice Box

- `FunctionCall.domain()` should probably not return `currentValue()`
- `VariableDeclaration.initialValue` — handle type mismatch
- `DataLiteral` – handle field type mismatch
- Get the field values from the declared `domain` when converting `SHARED` to `ISOLATED`
  - `SHARED` values cannot know their state
  - `ISOLATED` values can know their state intimately
