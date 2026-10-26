# Syntax and `trait`s

[ADRs](../README.md)

The `Ordered` `trait` should allow the `<` and `>` operators. `Equatable` allows `==` and `!=`. Both `trait`s together, allow `<=` and `>=`.

The `HasStringRepresentation` `trait` should allow use in string interpolations.

`Identifiable` might be used with `===` and `!==`. Or maybe those operators should be restricted to check address equality only? If the latter, should two `ISOLATED` variables that happen to share a memory address be considered equal? I lean towards “no.” They are not the same thing conceptually. Maybe the operators should only be applicable to `SHARED` variables?

`HashEquatable` might allow array/collection indexing syntax. E.g. `documents[docname]`.
