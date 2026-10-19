<!-- markdownlint-disable MD041 MD033 -->
<img src="../images/rawry.png" alt="Rawry" style="float: right; margin: 10px;">

# `subset` and `type

[ADRs](../README.md)

## Status

✍🏼 **Draft**

> A rough sketch of an idea

## Context

The `integer` and `real` universes support subsets based on ranges. Such a range might be useful to declare officially. The `truthvalue` universe has only three values/states and supports enumerated subsets selecting any one, two or all of said states.

A `real` also needs a representation (its precision). That is a separate property from its range (see [ADR-025](../adr-025.md)), so it is not part of a `subset`. A range alone is a `subset`. A range together with a representation is a `type`. This ADR covers named ranges, and the named bundles that standard numeric formats need.

**Terminology.** A `universe` is a top set (`integer`, `real`, `truthvalue`, `rc-type`). A `subset` is a universe plus a range. A `type` is a subset plus, for `real`, a representation.

![taxonomy](../images/type-taxonomy.svg)

## Decision

The `subset` keyword defines a named subset of the `truthvalue`, `integer` or `real` universes.

- `subset boolean = truthvalue(false|true)`
- `subset natural = integer(1...)`

Subset and type declarations do not propagate to the CIR. They are only aliases used by the frontend. The range and representation they stand for are carried by the variable's type.

### Binary integer widths

Integers have no precision axis: the range alone determines the representation, so a `subset` suffices.

- `subset int32 = integer(-2^31..<2^31)`
- `subset uint32 = integer(0..<2^32)`
- `subset int64 = integer(-2^63..<2^63)`
- `subset uint64 = integer(0..<2^64)`
- `subset int128 = integer(-2^127..<2^127)`
- `subset uint128 = integer(0..<2^128)`

### Balanced ternary integers

A balanced ternary range is symmetric and includes both ends, so it uses `...` rather than `..<`:

- `subset btint27 = integer(-(3^27-1)/2...(3^27-1)/2)`
- `subset btint54 = integer(-(3^54-1)/2...(3^54-1)/2)`
- `subset btint81 = integer(-(3^81-1)/2...(3^81-1)/2)`
- ...

### IEEE 754 binary floating point

A named floating-point format is a range plus a representation, so it is a `type`, not a `subset`:

```clawr
type float64 = real(-(2^53-1)*2^971...(2^53-1)*2^971) sig 53 bin
```

The range gives the largest finite magnitude. `sig 53 bin` gives 53 significant bits. IEEE has that many only down to the smallest normal number. Below it, the spacing is fixed (the subnormals), and `scale 1074 bin` expresses that floor: no finer than multiples of 2⁻¹⁰⁷⁴.

| Type       | `sig` (bits) | `scale` floor (bin) | Largest magnitude  |
| ---------- | ------------ | ------------------- | ------------------ |
| `float16`  | 11           | 24                  | (2^11−1)·2^5       |
| `float32`  | 24           | 149                 | (2^24−1)·2^104     |
| `float64`  | 53           | 1074                | (2^53−1)·2^971     |
| `float128` | 113          | 16494               | (2^113−1)·2^16271  |
| `float256` | 237          | 262378              | (2^237−1)·2^261907 |

These types are the deliberate exception to the exact-then-round-once rule of ADR-025:

- They mean _exactly_ the IEEE binary values, with rounding after each operation, so `(a * b) + c` matches existing numerical code. The language reference should state this openly.
- On binary hardware they map to native `float`/`double`. On ternary hardware they are emulated, slowly but correctly, with no source change. The principle is semantic portability, not performance portability.
- They cover the **finite** values only. NaN and ±∞ are not reals, and ±0 collapse to one real value. Interop with C `double` bit patterns is an explicit conversion at the boundary (for example from a `bitfield`).
- The alternative, "at least p bits, the hardware's choice", would make results differ between targets and break canonical equality, so it is rejected.

### Balanced ternary floating point

The base word `ter` is reserved. No ternary hardware exists yet, and the only layout reference is an independent draft (Ternary27: 27 trits made of a 2-trit type code, a sign trit, a 5-trit exponent and a 19-trit significand). It is not known whether that draft has been submitted to a standards body.

Values derived from the draft, to be verified before this is adopted:

```clawr
type btfloat27 = real(-(3^20-1)/2*3^102...(3^20-1)/2*3^102) sig 20 ter
```

- `sig 20` counts the sign trit, which is the leading digit of normal numbers. The floor `scale 145` comes from the exponent minimum of −121 plus 24 extended-significand trits for subnormals.
- Speculative: larger ternary representation might be formed as 1, 2, 3: `2*27 = 54` and `3*27 = 81`. The complete series would be: $3^k, 2 \cdot 3^k, k \in \mathbb{N}$
- In balanced ternary, round-to-nearest is truncation, so there are no ties.
- 1/3 is exact in `ter` and 1/2 is not, so `bin` and `ter` grids never nest. There is no implicit conversion between them, only an explicit `round`.
- The `bt` prefix (balanced) is meaningful: positive and balanced ternary give different value sets at the same digit count. Avoid `ternary27`, because `ternary` already names the truth value.
- Rounding-direction type codes, NaNs and infinities belong to a boundary type, as for the IEEE types.
- Speculative: larger types could be imagined as growing

## Rationale

- Easy reuse for type declarations.
- Seems like an obvious feature as subsets already play an important role.
- A named type that bundles range and representation cannot be written inconsistently. A prose convention ("use `sig 53` with this range") cannot be checked, and the pairing is what the name means.

## Open Questions

1. **Where do the standard types live?** In the standard library as ordinary declarations, or as built-in names?
2. **Self-reference.** The ranges above are written out. Should a type's maximum be available as `float64.max`?
3. **Sizes without a standard.** `btfloat54` and up, and any ternary decimal-like formats, wait for hardware and standards. Speculation: larger sizes might follow the series $3^k$ and $2 \cdot 3^k$ (27, 54, 81, 162, 243, ...), since $2 \cdot 27 = 54$ and $3 \cdot 27 = 81$.

## Related ADRs

- [ADR-005](../adr-005.md) Types are Sets
- [ADR-025](../adr-025.md) The `real` Datatype: Precision axes and bases
