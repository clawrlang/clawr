# Clawr Compiler Pipeline: Modular Structure

This document describes the modular architecture of the Clawr compiler, outlining each stage of the pipeline and its responsibilities.

## 1. Lexer (`src/lexer/`)

- Tokenizes Clawr source code into a stream of tokens.
- Exports token types and the `TokenStream` class.

## 2. Parser (`src/parser/`)

- Consumes tokens and produces an Abstract Syntax Tree (AST).
- Handles statements and expressions (e.g., variable declarations, print statements).

## 3. AST (`src/ast/`)

- Defines the structure of the language’s syntax tree.
- Types for modules, statements, and expressions.
- Designed to be platform-agnostic and reusable for other backends.

## 4. IR (Intermediate Representation) (`src/ir/`)

- Defines a C-like IR for code generation.
- Includes types for IR modules, statements, and expressions.
- `ir-generator.ts` lowers AST to IR.

## 5. Codegen (`src/codegen/`)

- Converts IR to C source code.
- Handles code emission for declarations, function calls, and expressions.

## 6. Runtime (`src/runtime/`)

- C runtime for memory management and primitive operations.
- Includes headers and implementations for all supported types.

## 7. CLI/Driver (`src/rwrc/`)

- Orchestrates the pipeline: reads source, tokenizes, parses, lowers, generates C, and invokes the C compiler.
- Handles command-line arguments and output file management.

---

### Modularity Principles

- Each stage is independently testable and replaceable.
- AST and IR are free of backend-specific details.
- The pipeline is designed for future extensibility (e.g., new backends, optimizations).

This structure supports clarity, maintainability, and future growth of the Clawr compiler.
