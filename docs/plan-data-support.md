# Implementation Plan: `data` Type Support in Clawr

## Goal

Enable full support for user-defined types using the `data` keyword, as described in the V1 normative spec. This is a key step toward self-hosting and writing real programs in Clawr.

## Steps (Pull Workflow)

1. **Plan a vertical slice**
   - Choose a concrete data example (syntax and semantics) to implement end-to-end.

2. **Design/Implement C Code**
   - Write the C struct, allocation, field access, and reference counting for the example.
   - Extend the runtime as needed.

3. **IR & Codegen**
   - Extend the IR to represent the needed constructs.
   - Implement codegen to emit the required C code.
   - Add tests to ensure the generated C code is correct.

4. **AST & Lowering**
   - Extend the AST to represent data types, fields, and literals.
   - Implement lowering from AST to IR for the data feature.

5. **Parser**
   - Implement parsing for data declarations and literals.

6. **Type Checking**
   - Enforce rules for field presence, types, and mutability/ref semantics.
   - Ensure data literals are context-typed and checked against declared types.

7. **Testing**
   - Add unit and E2E tests for data declarations, literals, field access, and assignment.

## Notes

- Generics and recursive fields are deferred.
- Only fields (no methods) in V1.
- Follow the field mutability/ref rules from the spec.

---

This plan should be tracked and updated as implementation progresses.
