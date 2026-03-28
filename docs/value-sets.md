# Types as Sets

A “type”  in Clawr is not a structural data representation. It is a fundamental value *kind*. A truth-value, for example, does not have a canonical numeric representation, and thus integers and Boolean values cannot be intermixed.

A type is not the entire message, though. Clawr variables are assigned *value-sets*. Each type defines a *top* set that is the default/fallback if no constraint is declared or inferred. A constrained subset can be a range or an enumerated list of individual values.

```clawr
subset boolean = truthvalue { false, true }
subset natural = integer [0...]
```

Constrained subsets can be used for optimisations. If the value is very small, it might fit in a `char` or `int8_t` C type. If it's a bit larger, it might still fit in a `uint32_t` or an `int64_t`. If the processor is ternary (not binary) integer sizes like 9 or 27 might be more appropriate.

If there is only one possible value returned from a function call or other expression, that whole expression can be replaced with the value, meaning there is less code to execute at runtime.

## Integers are not Real Numbers

In mathematics, the integers ($\mathbb{Z}$) are a subset to the real numbers ($\mathbb{R}$), and that is a fairly reasonable way to see things. It works to a point: `integer` literals can be used as a `real` values, but `integer` variables cannot.

In Clawr, an `integer` is a different kind of value than a `real` value. This is because integers are discrete. You can refer to an exact integer value, but an exact real value can only exist symbolically. And Clawr does not maintain symbolic values.

Any `integer` value can be used to initialise a `real` variable or field, or passed as an argument for a `real` function parameter. But comparing `real` numbers for equality is not generally useful. Therefore, `real` subsets cannot be enumerated.

```clawr
subset someReals = real { 1.0, 3.1415 } // Error — not supported; nonsensical
subset probability = real [0.0...1.0] // Reasonable
```

Actually no: An *explicit* `real` number (like `const x = 3.2`) is *exactly* the decimal value it is set to be. This is a perfectly known value with infinite zeroes in its decimal expansion. The value π is known to 100 digits. It is *exactly* those 100 digits. It is however *not equal* to 3.14 or even the to π with 99 digits. Nor is it equal to π with 101 digits. Do not check `real` values for equality unless you know that you have a specific (small) number of digits precision.

In other words: it *is* possible to define

```clawr
subset someReals = real { 1.0, 3.1415 }
```

But note that both of these numbers each has an infinite decimal expansion of zeroes after the last explicit decimal. That is how a specific `real` number is defined.
