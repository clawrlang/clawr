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
