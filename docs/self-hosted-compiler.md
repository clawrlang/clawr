# What is Needed for a Self-Hosted Compiler?

The major milestone for Clawr is to be able to build itself

✅ = implemented and functional

- Primitive types
  - ✅ `truthvalue`
  - `integer`
  - `real`
  - `string`
- User-defined types
  - ✅ Exposed `data` structures
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
  - `if/while/ const x = nullable`
  - `if/while/ const x = nullable`
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
  - `const`/`mut`/`ref`/either function parameters
  - `const`/`ref`/uniquelt referenced function parameters
- Test automation utilities (or is Bun test/npm test enough?)

## Probably not Needed

- Control flow: `until`/`forever`
- Control flow: `guard`/`else`/`unless`
- `regex` literal
- Retroactive modelling
  - `trait` for `data`
- Automatic serialization for “pure” `data`
  - No `ref` fields?
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
