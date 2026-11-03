# Standard Library for Clawr

There should be a standard library for Clawr that provides commonly used functions and utilities, ensuring consistency and reducing the need for developers to implement these from scratch.

The standard library should include functions for common tasks such as string manipulation, array operations, mathematical computations, and date/time handling. It should also provide utilities for error handling, logging, and configuration management. By having a well-defined standard library, Clawr can promote best practices and improve developer productivity.

The standard library should include:

- The `subset` and `type` definitions of [ADR-032](../adr-032.md)
- `copy(of:)` function that creates a shallow copy of a reference-counted object (allowing it to be transferred to the opposite isolation semantics)
- `print(_ x: HasStringRepresentation)`
- The built-in `trait`s, such as `HasStringRepresentation`

(add more standard library functions as needed)

Traits should affect syntax:

- `HasStringRepresentation`: can be used in string interpolation.
- `Equatable`: can be compared using equality operators (`==` and `!=`).
- `HashEquatable`: can be used as keys in hash-based collections, such as dictionaries and sets.
- `Ordered`: can be compared using relational operators (`<`, `>=`).
- `Ordered` and `Equatable`: can be compared with “-or-equal” operators (`<=`, `>=`).
- `Iterable`: can be used as the iterated collection in a `for`-`in` loop (or other iteration constructs).

Some of these definitions are used in static analysis and others affect runtime behavior. The staticanalysis definitions do not need to have a runtime representation, while the runtime definitions must be precompiled by the backend into a form that is available during program execution.

## Realisation

### Source of truth: Clawr declarations

The standard library is declared in Clawr source files (e.g. `packages/stdlib/*.clawr`). The frontend parses them and uses the resulting declarations for static analysis, so signatures are no longer hardcoded in the frontend (today: `copy(of:)` and `print(_:)` in `function-call.ts`). Only signatures are loaded for now; precompiling the declarations into a serialised form is deferred.

### `extern`

A function whose implementation is provided by the runtime (`libClawr`) is declared with the keyword `extern` and has no body:

```clawr
extern func print(_ x: HasStringRepresentation)
```

- `extern` declarations take part in static analysis like any other function.
- The backend lowers a call to an `extern` function to its mangled C name, which `libClawr` must export.
- Declarations without `extern` (traits, `subset`, `type`) are static-analysis definitions with no runtime symbol.
- Functions with Clawr bodies in the stdlib need precompilation and are out of scope for now.

### Namespace

Stdlib declarations live in a `namespace` (ADR-019), so user code can declare functions and types with the same names. The stdlib namespace is implicitly available to every program; its members can be used unqualified unless shadowed by a user declaration.

### Scope

The frontend creates a stdlib scope as the parent of the current root scope. Name lookup falls through from the root scope to the stdlib scope. The language server uses the same scope.

### Prerequisites and order

1. Implement `namespace` for free functions and types in the frontend (it is currently not implemented for functions).
2. Parse `extern func` (no body) and carry it through the semantic model. _(Done in the frontend: `extern` is a keyword, `FunctionDeclaration.isExtern` registers the signature without emitting a declaration, and calls lower to the plain C name.)_
3. Add the stdlib parent scope, initially empty.
4. Move `print(_:)` to an `extern` declaration. Boxing for a trait-typed parameter moves from `FunctionCall.emitStatement` into the generic rule for passing values to trait-typed parameters.
5. Add the built-in traits, then the `real` conversions (`float32`/`float64`).
6. Move `copy(of:)` once generics (see `generics.md`) can express its constraint.
