# Clawr Minimal Viable Language (MVL) and Milestone Plan

## Purpose

A stepping-stone towards a self-hosting Clawr compiler, focusing on the essential features needed to write real programs in Clawr. Advanced optimizations and syntax sugar are deferred.

## MVL Feature Set

- **Primitive types:**
  - `truthvalue` (three-state logic)
  - `integer` (pointer to arbitrary-precision structure, `Integer*`)
  - `real` (decimal, pointer to arbitrary-precision structure, `Real*`)
  - `string` (optional for MVL, but useful for self-hostings)
- **`data` keyword:**
  - Nominal, reference-counted, heap-allocated structures with fields
  - No generics or recursive fields in MVL
- **Basic expressions:**
  - Arithmetic, logical, and comparison operators
- **Control flow:**
  - If/else, while/for loops, function calls
- **Functions:**
  - First-class, with clear calling conventions
- **Value-sets:**
  - Support for type constraints and subsets (basic, not optimized)
- **Modules:**
  - Source files are modules; support for imports/exports is planned, but MVL may only support a single module (main program)
  - Current pipeline wraps statements in a `main()` function and always builds an executable
- **AST:**
  - Platform-agnostic, reusable for other backends
- **IR & Codegen:**
  - Lower to C, using runtime for primitives and data
- **Runtime:**
  - C runtime for memory, integer, truthvalue, and data support
- **Interoperability:**
  - Ability to call/link C libraries (FFI or similar)

## Main Milestone: Self-Hosting Readiness

- Clawr is mature enough to write the next version of itself in Clawr
- Advanced optimizations (value-set-based lowering, AST pruning, etc.) are deferred
- Syntax sugar and advanced features are not required for MVL

## Architectural Principles

- **Frontend (lexer, parser, AST):** Modular and reusable for other compilers/backends
- **Backend (IR, codegen, runtime):** C-only for now, but clean separation for future extensibility
- **Interoperability:** Plan for linking with C libraries to avoid reinventing the wheel

---

This plan should be updated as the project evolves and as new requirements emerge.
