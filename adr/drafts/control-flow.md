# Control-Flow

> Draft

## Context

A general-purpose programming language needs control-flow mechanics.

This separates procedural languages from declarative languages. A declarative language like VHDL or Haskell declare truths that must be fulfilled at all times (“invariants”). It cannot describe interactions. A procedural language defines operations that a program may perform and the algorithms that ensure that the invariants are maintained throughout.

Clawr supports three-valued truth. This affects how control-flow is defined. According to [ADR-006](../adr-006.md), the `ambiguous` state is not `true` and should be considered `false` in control-flow statements. But so should `!ambiguous`, because `ambiguous` is not actually `false`.

## Decision

Clawr supports `if`/`else`/`else-if` statements. (The syntax may be discussed. Should braces be required as in Swift? Should parentheses as in C? Should the else-if syntax use a single keyword like `elif` or `elsif`, or two words: `else if`?)

Clawr also supports `while` loops. Both `if` and `while` evaluate a truthvalue expression and choose the “true” branching only if the expression equals `true`. The `ambiguous` value is equivalent to `false` in this context in accordance with [ADR-006](../adr-006.md).

Clawr also supports `for`-`in` loops (as Swift). It does not support C-like `for` loops.

Finally, Clawr supports switching (both as expression and as statement) with pattern-matching using the keyword `match` or `when` and the double-arrow symbol, `=>`, which are more compact than `switch`/`case`, yet equally readable.

### Candidate Syntax

```clawr
if (t) {
} else if (!t) {
} else {}

// Quaternary operator?
const x = t ? "true" ~ "ambiguous" : "false"
const y = t ? "true" : "ambiguous or false"

const v = when t is {
    true => 1
    ambiguous => 0
    false => -1
}

match t {
    true { print("it's a given!") }
    ambiguous { print("who knows anything really?") }
    false { print("no way, no how!") }
}

while (t) {}
loop {} while (t)
for (const x in xs) {}
```

## Rationale

- C-style `for` loops emphasise implementation, not intent, and they a prone to off-by-one errors.
- The `switch`/`case` syntax feels heavy (personal opinion). There might be a valid case in that it is verbose and emphasises code structure over programmer intent.

## Related ADRs

- [ADR-006](../adr-006.md) (Three-valued Truth)
