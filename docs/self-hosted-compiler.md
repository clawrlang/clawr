# What is Needed for a Self-Hosted Compiler?

The major milestone for Clawr is to be able to build itself

✅ = implemented and functional

- Primitive types
  - ✅ `truthvalue`
  - ✅ `integer`
  - `real`
  - `string`
  - `binarylane` (formerly `bitfield`)
- String concatenation
- User-defined types
  - ✅ “Naked” `data` structures
  - Encapsulated `object` and `service` types
    - Inheritance & polymorphism
    - `ref` only for `service`
    - `const ref`?
  - `trait` for `object`
  - `role` for `service`
    - (same implementation as `trait` but `ref` only)
- Control-flow
  - `if`/`else if`/`else`
  - `when`/`=>`
  - `for`/`in`
  - `while`
  - `if/while/when const x = nullable` (like Swift `if let`/`guard let else`)
  - Swift `guard let else` exit scope (return/throw/panic/break/continue) if predicate is `false`/`ambiguous`
    - `const x = nullable ?? return`
    - `require (const x = nullable) else ...`
  - `break`/`continue`
- Operators and precedence
  - Primary (literals, parenthesised expressions)
  - Unary postfix (`!!`, `(`) (force assume not null, function-call)
  - Unary prefix (`-`, `!`, `~`)
  - Lanewise AND (`&`)
  - Lanewise XOR (`^`) (doubles as exponentiation)
  - Lanewise OR (`|`)
  - Multiplicative (`*`/`/`)
  - Additive (`+`/`-`)
  - Comparison (`==`, `<`, …)
  - Logical AND (`&&`)
  - Logical OR (`||`)
- Modules and imports
  - `helper` keyword (make visible code units hidden)
  - Avoid circular refs? (module1 -> module2 -> module1)
- Data semantics
  - ✅ `const`/`mut`/`ref` variables
  - ✅ `__rc_ISOLATED`/`__rc_SHARED` allocations
- Function semantics
  - `const`/`mut`/`ref`/_either_ parameters
  - `const`/`ref`/_uniquely referenced_ return values
- Test automation utilities (or is Bun test/npm test enough?)
- VS Code extension (syntax and semantics)

## Recommended Build Order

Prioritise features that unlock writing the compiler in Clawr with the smallest semantic surface area first.

1. Control-flow (minimal core)
2. Operators and precedence (minimal core)
3. Encapsulated `object`/`service` types

Current focus: Milestone A (Control-flow)

Roadmap status:

- [ ] Milestone A complete
- [ ] Milestone B complete
- [ ] Milestone C complete

### Integrated Plan: Where Modules Fit

Yes, module support should be integrated, not treated as an isolated side track.

Recommended sequencing:

1. Milestone A1: Control-flow core in a single-module world.
2. Milestone A2: Module/import foundations (lexer, AST, parser, semantic model).
3. Milestone B: Operators and precedence on top of multi-module analysis.
4. Milestone C: Encapsulation/subtyping after modules and operators are stable.

Milestone gates:

- Gate to start B: module graph resolution works, import cycles are diagnosed, and helper visibility is enforced at top-level.
- Gate to start C: at least one non-trivial compiler subsystem compiles/runs across multiple modules with stable control-flow and operator semantics.

Why this integration is important:

- Generation-2 bootstrap requires deterministic compilation units and dependency order.
- Visibility (`helper`) only becomes meaningful with cross-module boundaries.
- Many operator/control-flow tests can stay local, while module tests validate composition and build reproducibility.

### Milestone A: Bootstrap Control-Flow

Scope:

- [ ] `if`/`else`
- [ ] `while`
- [ ] `break`/`continue`

Done criteria:

- [ ] Parser supports these constructs in statement position.
- [ ] Semantic analysis validates branch/loop scoping rules.
- [ ] Lowering generates correct C control-flow.
- [ ] At least one compiler subsystem-style example can be expressed without workarounds (for example token scanning loops and branching error paths).

### Milestone B: Bootstrap Operators

Scope:

- [ ] Primary and parenthesised expressions
- [ ] Unary prefix (`-`, `!`)
- [ ] Multiplicative (`*`, `/`)
- [ ] Additive (`+`, `-`)
- [ ] Comparison (`==`, `<`, `<=`, `>`, `>=`)
- [ ] Logical AND/OR (`&&`, `||`)

Done criteria:

- [ ] Precedence and associativity are deterministic and tested.
- [ ] Mixed expression trees lower correctly in codegen and e2e tests.
- [ ] Integer and truthvalue behavior is fully covered in unit tests.

### Milestone C: Encapsulation and Subtyping

Scope:

- [ ] Encapsulated `object`/`service`
- [ ] Inheritance and polymorphism
- [ ] `ref` restrictions for `service`

Done criteria:

- [ ] Method dispatch model is specified and implemented.
- [ ] Type checker enforces visibility and subtyping constraints.
- [ ] Runtime ownership semantics are defined for object/service hierarchies.
- [ ] Existing `data`-based compiler code can migrate incrementally rather than all-at-once.

### Practical Rule for Self-Hosting

Do not start Milestone C until A and B are stable enough that new compiler features are mostly blocked by abstraction/encapsulation concerns rather than language expressiveness.

## Definition of Done: Self-Hosting v1

The project can be considered self-hosting v1 complete when all of the following are true:

- [ ] The Clawr compiler source can be implemented in Clawr without requiring language-level workarounds for missing control-flow or operator support.
- [ ] The Clawr-implemented compiler can compile itself end-to-end at least once in CI.
- [ ] The generated compiler binary passes the same unit, codegen, and e2e suites currently used for the TypeScript implementation.
- [ ] Rebuilding the compiler from its own output is stable for at least one additional generation (two-step bootstrap sanity check).
- [ ] The bootstrap path (commands, expected artifacts, and failure diagnostics) is documented and reproducible from a clean checkout.

### Bootstrap Command Draft

The following is a proposed baseline flow for bootstrap validation. It is intentionally close to the current development commands.

1. Validate baseline implementation and tests (host compiler).

   ```sh
   npm run test
   ```

2. Build the host-side compiler executable.

   ```sh
   bun run build
   ```

3. Compile the Clawr compiler source using the host compiler (generation 1).

   ```sh
   # Draft placeholder command; replace with actual rwrc invocation once finalized.
   ./dist/rwrc <path-to-clawr-compiler-source> --out dist/rwrc-gen1
   ```

4. Use generation 1 to compile the same source again (generation 2).

   ```sh
   ./dist/rwrc-gen1 <path-to-clawr-compiler-source> --out dist/rwrc-gen2
   ```

5. Run the standard suite with generation 2 as active compiler in the bootstrap test path.

   ```sh
   # Draft placeholder: wire generation-2 binary into the existing test harness.
   npm run test
   ```

6. Record and compare bootstrap artifacts (binary size/hash, logs, failing tests if any).

   ```sh
   # Example diagnostics; keep or replace as needed.
   shasum dist/rwrc dist/rwrc-gen1 dist/rwrc-gen2
   ```

## V1 Draft: Modules, Imports, and Helper Visibility

This section is a parser-oriented proposal intended to be minimal for self-hosting.

### Goals

- Explicit dependency graph for deterministic builds.
- Two visibility levels only: public (default) and helper.
- One keyword (`helper`) with one meaning: hidden outside its declaration boundary.

### Source Model

- One file is one module.
- A module belongs to exactly one library/package.
- Imports are compile-time only (no runtime loader semantics in V1).

### Surface Syntax (V1)

Import forms:

- `import Name from "path/to/module"`
- `import Name as Alias from "path/to/module"`
- `import Name1, Name2 from "path/to/module"`
- `import Name1 as Alias1, Name2 from "path/to/module"`

Declaration visibility:

- `data`/`object`/`service`/free `fn` are public by default.
- Prefix with `helper` to restrict visibility.
- `object`/`service` fields are private in V1.
- `object`/`service` methods are public by default; `helper` methods are private to the declaring type.

Examples:

- `helper fn scanNumber(...) { ... }`
- `helper data ParserState { ... }`
- `object Lexer { helper fn scanNumber(...) { ... } }`

### Grammar Sketch (Parser-Ready)

```plain
module            ::= import_decl* top_decl*

import_decl       ::= "import" import_items "from" string_literal

import_items      ::= import_item ("," import_item)*
import_item       ::= Identifier ("as" Identifier)?

top_decl          ::= visibility? top_decl_core
visibility        ::= "helper"

top_decl_core     ::= data_decl
                    | object_decl
                    | service_decl
                    | fn_decl

method_decl       ::= visibility? "fn" Identifier signature block
```

### Name Resolution Order (V1)

Within a function/method body:

1. Local bindings and parameters.
2. Type members (if inside `object`/`service` method).
3. Imported names.
4. Same-library helper top-level names (only if current module is in the same library).

### Visibility Rules (V1)

- Public top-level declarations are visible to any module that can import the declaration's module.
- Helper top-level declarations are visible only from modules in the same library/package.
- Public methods are visible where the type is visible.
- Helper methods are visible only inside the declaring type body.
- Fields of `object`/`service` are always private in V1.

### Static Errors (V1)

- Unknown import symbol: imported name is not exported by target module.
- Visibility violation: reference to helper declaration from outside its boundary.
- Duplicate import alias/name in the same module scope.
- Import cycle detected (hard error in V1).
- Ambiguous reference after imports/local declarations.

### Notes for Later (Post-V1)

- Namespace blocks/qualified names.
- Wildcard imports.
- Re-export chains and barrel modules.
- Package registry resolution beyond relative or declared library roots.

## Implementation Checklist: V1 Modules/Imports/Helper

This checklist maps the V1 design to the current codebase layout for incremental implementation.

### Phase 1: Lexer and AST Foundations

Targets:

- `src/lexer/kinds.ts`
- `src/lexer/index.ts`
- `src/ast/index.ts`

Checklist:

- [ ] Add/confirm tokens for `import`, `from`, `as`, and `helper`.
- [ ] Add AST nodes for import declarations (`module path`, imported names, aliases).
- [ ] Add visibility annotation on top-level declarations (`public` default, `helper` explicit).
- [ ] Add AST representation for method visibility in `object`/`service` declarations.

### Phase 2: Parser Integration

Targets:

- `src/parser/index.ts`
- `src/parser/expression-parser.ts` (only if needed for grammar conflicts)
- `src/parser/statement-parsers/*` (or add dedicated declaration parser files)

Checklist:

- [ ] Parse leading import blocks at module/file scope.
- [ ] Parse import item aliases (`Name as Alias`).
- [ ] Parse `helper` before top-level `data`/`object`/`service`/`fn`.
- [ ] Parse `helper` before `object`/`service` methods.
- [ ] Emit precise diagnostics for malformed import lists and missing `from` strings.

### Phase 3: Semantic Analysis (Single-Module)

Targets:

- `src/semantic-analyzer/ast.ts`
- `src/semantic-analyzer/index.ts`

Checklist:

- [ ] Carry import declarations into semantic module representation.
- [ ] Carry declaration visibility (`public`/`helper`) into semantic declarations.
- [ ] Enforce method-level helper visibility within declaring type boundaries.
- [ ] Keep existing behavior unchanged for projects that do not use imports/helper.

### Phase 4: Module Graph and Resolution Pass

Targets:

- `src/rwrc/index.ts` (entry orchestration)
- New file suggestion: `src/semantic-analyzer/module-graph.ts` (or similar)

Checklist:

- [ ] Resolve import paths to module files.
- [ ] Build dependency DAG and detect cycles.
- [ ] Produce a deterministic module processing order.
- [ ] Resolve imported symbol names/aliases against target module exports.
- [ ] Enforce top-level helper boundary at library/package scope.

### Phase 5: Lowering and Codegen Wiring

Targets:

- `src/ir/index.ts`
- `src/ir/ir-generator.ts`
- `src/codegen/index.ts`

Checklist:

- [ ] Ensure multi-module semantic input lowers in deterministic order.
- [ ] Prevent emission of helper-only symbols into public linkage surfaces as needed.
- [ ] Keep generated runtime calls and ownership semantics unchanged.

### Phase 6: Tests and Fixtures

Targets:

- `tests/unit/lexer.test.ts`
- `tests/unit/parser.test.ts`
- `tests/unit/sem-analyzer.test.ts`
- `tests/unit/lowering.test.ts`
- `tests/e2e/*`

Checklist:

- [ ] Add lexer coverage for all new keywords and token combinations.
- [ ] Add parser coverage for all import forms and helper placements.
- [ ] Add semantic tests for visibility violations and valid helper usage.
- [ ] Add module-graph tests for cycle detection and deterministic order.
- [ ] Add e2e fixture with at least two modules and one helper-hidden symbol.

### Suggested First PR Slice

- [ ] Phase 1 + Phase 2 only (syntax accepted, no cross-module semantic resolution yet).
- [ ] Parser and AST tests updated.
- [ ] Feature-gate semantic enforcement until module graph pass lands.

## Probably not Needed

- Control flow: `until`/`forever`
- Control flow: `guard`/`else`/`unless`
- `regex` literal
- Retroactive modelling & `trait` for `data`
- Automatic serialization for “pure” `data`
  - No `object` fields
  - Other constraints?
- Lattice information
  - Explicit subsets: `integer in [0...]`, `truthvalue in {true, false}`
  - Inferred subsets
  - Named subsets: `subset boolean = truthvalue in {true, false}`
  - Path/expression level resolution
- Function currying on labels `curry rotateUp as rotate(by: true)`
  - (Maybe this should not be called “currying”?)
- Lowering to fixed-width types based on lattice information
- AST pruning based on possible expression values
- ref-counting optimisation
  - `releaseRC()` early
  - `mutateRC()` rarely
- Type/value-set inference
- Package dependencies
- Frameworks and libraries
- Parallel execution of tests
- String interpolation & multiline string literals
- Operator overloading
  - Use `trait`
  - Need `Self` reference? (I do not want the PAT problem. Do not infer types by the expected result.)
- `ternarylane` (formerly `tritfield`)
- Advanced IDE support
