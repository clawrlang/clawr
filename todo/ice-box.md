# Ice Box

- Do the tests perform too much setup?
- Publish the JSON schema to <http://clawr.lang/schema/cir/DRAFT-0> (preliminary URL)
- `FunctionCall.declaredLattice()` should probably not return `currentValue()`
- `VariableDeclaration.initialValue` — handle type mismatch
- `DataLiteral` – handle field type mismatch
- Get the field values from the declared lattice when converting `SHARED` to `ISOLATED`
  - `SHARED` values cannot know their state
  - `ISOLATED` values can know their state intimately
