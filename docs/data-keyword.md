# Data Keyword in Clawr

This document defines the V1 implementation plan for `data` declarations.

## V1 Normative Spec

This section is implementation-facing. If exploratory notes elsewhere disagree, this section wins.

### Core Model

- `data` defines a nominal, heap-allocated, reference-counted structure.
- `data` has fields only; instance methods are not part of `data` in V1.
- Each `data` declaration is a distinct type, even if field sets are identical.
- Generics are deferred.
- Recursive `data` fields are deferred.

### Field Model

- Fields are mutable (`mut`) by default.
- `ref` fields are allowed.
- `const` fields are deferred (not required in V1).
- A `const` variable of a `data` type with no `ref` fields is structurally immutable.
- A `ref` variable referencing `data` with mutable fields uses shared semantics.
- A `mut` variable referencing `data` uses isolated semantics with copy-on-write on mutation.

### Declaration and Literal Syntax

- Declaration syntax:
  - `data Name { field: ValueSet, otherField: OtherValueSet }`
- Literal syntax:
  - `{ field: Expression, otherField: Expression }`
- Field separators:
  - Fields may be separated by newline and/or comma in declarations and literals.

### Initialization Rules

- Data literals are context-typed only in V1.
- A concrete `data` type must be known by context or annotation before literal checking.
- Literal initialization is the only initializer in V1.
- Function-like constructors for `data` are out of scope for V1.

### Type Checking Rules

- Literals must provide all required fields.
- Extra/unknown fields are rejected.
- Each field expression must be assignment-compatible with the field ValueSet.
- Literal-to-target checking is nominal and target-driven (no anonymous structural type creation).
- Field-level semantics compatibility applies (including `ref` fields).

### Mutation Rules

- Direct field mutation is allowed through `mut` variables.
- Direct field mutation through `const` variables is rejected.
- Direct field mutation through `ref` variables is allowed (shared mutation semantics).
- For isolated mutation sites, lowering must ensure copy-on-write with `mutateRC()` before in-place writes.

### Runtime and Lowering Model

- Each `data` declaration lowers to a dedicated C struct.
- Each lowered `data` type has a corresponding `__type_info Nameˇtype` instance.
- Allocation uses `allocRC(Name, semantics)` with the generated type metadata.
- Retain/release hooks must retain/release nested reference-counted fields.
- Explicit copy uses runtime copy path (`copyRC`) and returns a uniquely referenced allocation.

### Companion and Static API Notes

- `data` has no instance methods in V1.
- If static helper APIs are needed, the intended mechanism is a same-name `companion` declaration (future work).
- Trait conformance and retroactive modeling are deferred.

### V1 Conservatism

- Prefer explicitness over inference.
- Do not introduce anonymous structural data types in V1.
- Keep diagnostics precise, naming missing/extra fields and incompatible field assignments.

## Compiler Implementation Checklist (V1)

1. Parse and AST
   - Parse `data` declarations with named fields.
   - Parse field annotations as ValueSet types.
   - Parse data literals with named fields.
   - Preserve source positions for field-level diagnostics.

2. Type Registry
   - Register each `data` declaration as a nominal type.
   - Store field maps and field ValueSet constraints in semantic context.

3. Literal Type Checking
   - Require target/context type for data literals.
   - Validate required-field completeness and unknown-field rejection.
   - Validate field expression compatibility against field ValueSet.

4. Assignment and Variable Compatibility
   - Reuse variable semantics matrix (`const`/`mut`/`ref`) with `data` as an entity family.
   - Enforce explicit conversion boundaries where semantics crossing requires copy.

5. Field Access and Mutation
   - Lower field reads for typed `data` values.
   - Lower field writes for `mut` and `ref` according to semantics rules.
   - Emit `mutateRC()` for isolated mutation paths.

6. Runtime Integration
   - Generate metadata hooks for nested retain/release.
   - Ensure generated C compiles and links with runtime headers.

7. Diagnostics
   - Missing field: name missing keys.
   - Unknown field: name extra keys.
   - Incompatible field value: name field and expected ValueSet.

8. Testing
   - Parser tests for declaration and literal forms.
   - Semantic tests for field completeness and compatibility.
   - Codegen tests for allocation, field read/write, and mutation strategy.
   - E2E tests for copy-on-write behavior with field mutation.
