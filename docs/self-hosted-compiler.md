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

1. Milestone A1: Control-flow core
2. Milestone A2: Modules/imports/helper visibility foundations
3. Milestone B: Operator and precedence stabilization across modules
4. Milestone C: Encapsulated `object`/`service` types

Current focus: Milestone A2 (Modules/imports/helper visibility)

Roadmap status:

- [x] Milestone A1 complete
- [ ] Milestone A2 complete
- [ ] Milestone B complete
- [ ] Milestone C complete

### Integrated Plan: Where Modules Fit

Yes, module support should be integrated, not treated as an isolated side track.

Recommended sequencing:

1. Milestone A1: Control-flow core in a single-module world.
2. Milestone A2: Module/import foundations (lexer, AST, parser, semantic model).
3. Milestone B: Operators and precedence hardening on top of multi-module analysis.
4. Milestone C: Encapsulation/subtyping after modules and operators are stable.

Milestone gates:

- Gate to mark B complete: operator precedence/associativity tests and mixed-expression lowering pass in both single-module and multi-module fixtures.
- Gate to start C: A1 and A2 are complete end-to-end, and B stabilization checks are green.

Why this integration is important:

- Generation-2 bootstrap requires deterministic compilation units and dependency order.
- Visibility (`helper`) only becomes meaningful with cross-module boundaries.
- Many operator/control-flow tests can stay local, while module tests validate composition and build reproducibility.

### Milestone A1: Bootstrap Control-Flow

Scope:

- [x] `if`/`else`
- [x] `while`
- [x] `break`/`continue`
- [x] Truthvalue condition semantics: `if (x)`/`while (x)` are strict-true checks (`x == true`), so `ambiguous` follows `else` or exits loops.

Done criteria:

- [x] Parser supports these constructs in statement position.
- [x] Semantic analysis validates branch/loop scoping rules.
- [x] Lowering generates correct C control-flow.
- [x] At least one compiler subsystem-style example can be expressed without workarounds (for example token scanning loops and branching error paths).

### Milestone A2: Modules, Imports, and Helper Visibility

Scope:

- [ ] `import ... from "..."`
- [ ] `as` aliases in import items
- [ ] `helper` visibility on top-level declarations
- [ ] `helper` visibility on `object`/`service` methods
- [ ] Module graph resolution and cycle diagnostics

Done criteria:

- [ ] Lexer and AST represent `import`, `from`, `as`, and `helper`.
- [ ] Parser accepts import blocks, aliases, and helper-qualified declarations with precise diagnostics.
- [ ] Semantic analysis carries visibility/import information without regressing single-file programs.
- [ ] Module graph resolution is deterministic and rejects cycles.
- [ ] At least one multi-module e2e fixture proves helper-hidden symbols are enforced.

### Milestone B: Bootstrap Operators

Status:

- [x] Core parsing support for operator precedence exists.
- [ ] Cross-module stabilization and regression hardening remains.

Scope:

- [ ] Preserve deterministic precedence and associativity in parser and lowering.
- [ ] Verify mixed expression trees in multi-module analysis paths.
- [ ] Maintain operator behavior regressions for integer and truthvalue paths.

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

Do not start Milestone C until A1 and A2 are complete and Milestone B stabilization is green, so remaining blockers are abstraction/encapsulation concerns rather than core language gaps.

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

## Implementation Checklist: A1/A2/B Flow

This checklist maps the roadmap to the current codebase layout in execution order.

### Phase A1.1: Control-Flow Parser and AST Foundations

Targets:

- `src/ast/index.ts`
- `src/parser/index.ts`
- `tests/unit/parser.test.ts`

Checklist:

- [x] Add AST nodes for `if`/`else`, `while`, `break`, and `continue` statements.
- [x] Parse control-flow statements with nested block support.
- [x] Add parser coverage for `if`/`else`, `else if`, and loop flow statements.

### Phase A1.2: Control-Flow Semantics and Lowering

Targets:

- `src/semantic-analyzer/ast.ts`
- `src/semantic-analyzer/index.ts`
- `src/ir/ir-generator.ts`
- `src/codegen/index.ts`
- `tests/unit/sem-analyzer.test.ts`
- `tests/unit/lowering.test.ts`
- `tests/e2e/*`

Checklist:

- [x] Validate branch and loop scoping rules in semantic analysis.
- [x] Validate `break`/`continue` placement and loop boundaries.
- [x] Lower control-flow statements to correct C control structures.
- [x] Add unit and e2e fixtures for control-flow-heavy compiler-style scenarios.

### Phase A2.1: Lexer and AST Foundations

Targets:

- `src/lexer/kinds.ts`
- `src/lexer/index.ts`
- `src/ast/index.ts`

Checklist:

- [x] Add/confirm tokens for `import`, `from`, `as`, and `helper`.
- [x] Add AST nodes for import declarations (`module path`, imported names, aliases).
- [x] Add visibility annotation on top-level declarations (`public` default, `helper` explicit).
- [ ] Add AST representation for method visibility in `object`/`service` declarations.

Current slice: top-level visibility is currently carried for `data` declarations only.

### Phase A2.2: Parser Integration

Targets:

- `src/parser/index.ts`
- `src/parser/expression-parser.ts` (only if needed for grammar conflicts)
- `src/parser/statement-parsers/*` (or add dedicated declaration parser files)

Checklist:

- [x] Parse leading import blocks at module/file scope.
- [x] Parse import item aliases (`Name as Alias`).
- [ ] Parse `helper` before top-level `data`/`object`/`service`/`fn`.
- [ ] Parse `helper` before `object`/`service` methods.
- [ ] Emit precise diagnostics for malformed import lists and missing `from` strings.

Current slice: `helper` parsing is wired for top-level `data` declarations only.

### Phase A2.3: Semantic Analysis (Single-Module)

Targets:

- `src/semantic-analyzer/ast.ts`
- `src/semantic-analyzer/index.ts`

Checklist:

- [ ] Carry import declarations into semantic module representation.
- [ ] Carry declaration visibility (`public`/`helper`) into semantic declarations.
- [ ] Enforce method-level helper visibility within declaring type boundaries.
- [ ] Keep existing behavior unchanged for projects that do not use imports/helper.

### Phase A2.4: Module Graph and Resolution Pass

Targets:

- `src/rwrc/index.ts` (entry orchestration)
- New file suggestion: `src/semantic-analyzer/module-graph.ts` (or similar)

Checklist:

- [ ] Resolve import paths to module files.
- [ ] Build dependency DAG and detect cycles.
- [ ] Produce a deterministic module processing order.
- [ ] Resolve imported symbol names/aliases against target module exports.
- [ ] Enforce top-level helper boundary at library/package scope.

### Phase A2.5: Lowering and Codegen Wiring

Targets:

- `src/ir/index.ts`
- `src/ir/ir-generator.ts`
- `src/codegen/index.ts`

Checklist:

- [ ] Ensure multi-module semantic input lowers in deterministic order.
- [ ] Prevent emission of helper-only symbols into public linkage surfaces as needed.
- [ ] Keep generated runtime calls and ownership semantics unchanged.

### Phase A2.6: Tests and Fixtures

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

### Phase B: Operator Stabilization and Regression

Targets:

- `tests/unit/parser.test.ts`
- `tests/unit/lowering.test.ts`
- `tests/e2e/*`

Checklist:

- [ ] Add cross-module regression fixtures that combine operators with imports.
- [ ] Verify precedence remains deterministic after module graph integration.
- [ ] Keep integer and truthvalue operator behavior stable in e2e runs.

### Milestone Risk Register

- [ ] Loop scope correctness: variable lifetime and state transitions across `break`/`continue`.
- [ ] Deterministic module ordering: import DAG stability and cycle diagnostics.
- [ ] Helper boundary enforcement: visibility checks across package/library boundaries.

### Suggested PR Slices

- [x] PR1: Phase A1.1 only (control-flow syntax + AST + parser tests).
- [x] PR2: Phase A1.2 (control-flow semantics/lowering + unit/e2e tests).
- [ ] PR3: Phase A2.1 + Phase A2.2 (module/import/helper syntax + parser tests).
- [ ] PR4: Phase A2.3 + A2.4 + A2.6 (semantic resolution + module graph + tests).
- [ ] PR5: Phase B stabilization suite across multi-module fixtures.

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
