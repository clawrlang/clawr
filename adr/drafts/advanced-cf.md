&nbsp; / &nbsp; [Architecture Decision Records](../README.md) &nbsp; / &nbsp; [ADR Sketches](./README.md)

# Advanced Control-Flow

> Status: 🗳️ Idea

## `for`/`in` Loops

Initial Control-Flow functionality in Clawr was implemented in [ADR-039](../adr-039.md). It is limited to basic constructs like `if`/`else` and loops, with three-valued logical negation.

When implementing colletions in the standard library, Clawr should provide support for iterating over them in a consistent and expressive manner.

The draft proposes `for`-`in` loops (as Swift), not C-like `for` loops.

```clawr
for const x in xs { print(x) }
```

## `match`/`when` Expressions

Simple `if`/`else` statements are not sufficient for expressing complex control-flow scenarios. Repeating similar conditional checks can lead to verbose and error-prone code, making it harder to maintain and understand. Other languages provide constructs like `switch`/`case` and pattern matching to address this issue.

Clawr aims to provide a more expressive and readable alternative to traditional `switch`/`case` constructs by introducing `match` and `when` expressions.

```clawr
// Expression-style: `when` - each arm must be an expression
const v = when t is {
    true => 1
    ambiguous => 0
    false => -1
}

// Statement-style: `match` - each arm is a block of statements
match t {
    true: { print("it's a given!") }
    ambiguous: { print("who knows anything really?") }
    false: { print("no way, no how!") }
}

match num {
    1: { print("a single") }
    2: { print("a couple") }
    < 5: { print("several") } // Pattern matching with relational operators - also works for `when` expressions
    _: { print("many") }
}
```

> [!note] Unfinished Syntax
>
> The syntax is not settled. The examples above are chosen to reminice of functions — a `=>` for expression-style (like implicit return) arms and a block-style `{...}` for statement-style arms. The colon (`:`) perhaps breaks the visual similarity though.

```clawr
// Statement-style without colons after the patterns
match t {
    true { print("it's a given!") }
    ambiguous { print("who knows anything really?") }
    false { print("no way, no how!") }
}
```

> [!note] Single Keyword?
>
> It might be worth considering whether a single keyword (skip either `match` or `when`) could be used for both expression-style and statement-style pattern matching, with the distinction instead made based on the presence of `=>` versus `{...}`. This could simplify the syntax and reduce cognitive load for the programmer.

```clawr
// Statement-style: `match` becomes `when` with `is` and block-style arms
when t is {
    true: { print("it's a given!") }
    ambiguous: { print("who knows anything really?") }
    false: { print("no way, no how!") }
}
```

Unlike C, switch blocks do not “fall through” by default. Each case is independent, and only the matching case is executed. Swift allows explicit fallthrough with the `fallthrough` keyword, but Clawr does not support this feature. To compensate, perhaps, multiple patterns can be combined in a single arm using commas.

- Multiple patterns can be combined in a single arm using commas, e.g., `1, 2, 3: { ... }`.

## Speculative Ideas

Pattern-matching with `match` and `when` allows for more expressive and concise handling of complex data structures and conditions.

```clawr
// Should also be possible to match `data` structures and `union` types with patterns.
const x = structure {
    {value: 1} => "one”
    {value: 2} => "two”
    {scale: > 2} => "precise”
    _ => "unknown"
}

match unionValue {
    CaseA: { print("matched CaseA") }
    // speculative string interpolation syntax
    CaseB { prop1: x, prop2 }: { print("matched CaseB with prop1: \(x) and prop2: \(prop2)") }
}
```

Traditional languages typically operate with binary “Boolean” truthvalues (`true` and `false`). They generally provide a “ternary operator” to handle conditional expressions, such as `condition ? trueValue : falseValue`.

A ternary operator takes three operands: a condition, a value if the condition is true, and a value if the condition is false. In Clawr, a truthvalue (`t`) can also be `ambiguous`, which is neither `true` nor `false`. That hints at the need for a fourth operand to handle the `ambiguous` case - a _quaternary operator_.

```clawr
// Quaternary operator? Might be a tad too innovative for now
const x = t ? "true" ~ "ambiguous" : "false"
const y = t ? "true" : "ambiguous or false"
```

Swift also has a concept of guard statements, which allow early exit from a block based on a condition. Clawr might adopt a similar idea for handling truthvalue conditions.

Guard statements trigger early exit based on some condition. The block must end with an exit statement (`continue`, `break`, `return`, etc.).

```clawr
// Only `true` statements are accepted by the guard; `false` and `ambiguous` are not.
guard t or { return } // Exit if `t` is false or ambiguous
guard t != false or { return } // Exit if `t` is false only
```

Note that [string interpolation](./string-interpolation.md) is not yet implemented. The syntax is yet to be decided. The example above borrows from Swift.

## Rationale

- C-style `for` loops emphasise implementation, not intent, and they a prone to off-by-one errors.
- The `switch`/`case` syntax feels heavy (personal opinion). There might be a valid argument for claiming that it is verbose and that it emphasises code structure over programmer intent. The segregation between `match` and `when` helps distinguish between statement-style and expression-style control flow, making the programmer's intent clearer.

## Related ADRs

- [ADR-039](../adr-039.md) (Control-Flow)
