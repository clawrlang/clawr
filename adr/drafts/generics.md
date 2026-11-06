# Generics in Clawr

> Status: 🗳️ Idea

Today this is necesary:

```clawr
func pass(_ x: real sig 5 dec) -> real sig 5 dec {
    return x
}
func twice(_ x: real sig 5 dec) -> real sig 5 dec {
    const y: real sig 5 dec = x + x
    return y
}
func big(_ x: integer) -> integer {
    return x * 2
}
@main {
    print(pass(1.5))
    print(twice(2.25))
    print(big(21))
}
```

It should be possible to write the functions without specifying the exact precision of the `real` type.

```clawr
func pass(_ x: real) -> real {
    return x
}
func twice(_ x: real) -> real {
    const y = x + x
    return y
}
func big(_ x: integer) -> integer {
    return x * 2
}
```

… but that requires support for generic real types, where the precision is inferred or specified separately from the function signature.

What should the syntax and semantics for generic real types look like?

- `func pass<R: real>(_ x: R) -> R` seems like the established way to write a generic real function, where `R` is a type parameter constrained to the `real` type.
- `func pass(_ x: real) -> real` could work, but it is ambiguous which precision of `real` should be used for the argument and return value.
