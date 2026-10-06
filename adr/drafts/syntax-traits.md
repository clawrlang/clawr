<!-- markdownlint-disable MD041 MD033 -->
<img src="../images/rawry.png" alt="Rawry" style="float: right; margin: 10px;">

# Syntax and `trait`s

The `Ordered` `trait` should allow the `<` and `>` operators. `Equatable` allows `==` and `!=`. Both `trait`s together, allow `<=` and `>=`.

The `HasStringRepresentation` `trait` should allow use in string interpolations.

`Identifiable` might be used with `===` and `!==`. Or maybe those operators should be restricted to check address equality only?

`HashEquatable` might allow array/collection indexing syntax. E.g. `documents[docname]`.
