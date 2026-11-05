&nbsp; / &nbsp; [Architecture Decision Records](./README.md)

# Ternary `subset` and `type`

> Status: ✍🏼 Draft

## Context

With [ADR-032](../adr-032.md), the Clawr language introduced the concepts of `subset` and `type` for the `integer`, `real`, and `truthvalue` universes. This ADR extends the idea to balanced ternary integers and explores how named subsets and types can be defined for them.

## Musings

Integers have no precision axis: the range alone determines the representation, so a `subset` suffices.

- `subset int32 = integer(-2^31..<2^31)`
- `subset uint32 = integer(0..<2^32)`
- `subset int64 = integer(-2^63..<2^63)`
- `subset uint64 = integer(0..<2^64)`
- `subset int128 = integer(-2^127..<2^127)`
- `subset uint128 = integer(0..<2^128)`

### Balanced ternary integers

A balanced ternary range is symmetric and includes both ends, so it uses `...` rather than `..<`:

- `subset int27b = integer(-(3^27-1)/2...(3^27-1)/2)`
- `subset int54b = integer(-(3^54-1)/2...(3^54-1)/2)`
- `subset int81b = integer(-(3^81-1)/2...(3^81-1)/2)`
- ...

The ranges are well known and commonly used in balanced ternary arithmetic. The subset names, however, should match future conventions for naming balanced C-like ternary types. The `b` suffix is entirely speculative, and merely indicates that these are balanced ternary subsets.

### IEEE-shaped ternary types

Clawr currently defines binary types like this one:

```clawr
type binary64 = real(-(2^1024-2^971)...(2^1024-2^971)) sig 53 bin
```

| type      | Name                | Precision | Exponent | Exponent min | Exponent max | Max value            |
| --------- | ------------------- | --------- | -------- | ------------ | ------------ | -------------------- |
| binary16  | Half precision      | 11 bits   | 5 bits   | −14          | 15           | 65504                |
| binary32  | Single precision    | 24 bits   | 8 bits   | −126         | 127          | $3.40×10^{38}$       |
| binary64  | Double precision    | 53 bits   | 11 bits  | −1022        | 1023         | $1.80×10^{308}$      |
| binary128 | Quadruple precision | 113 bits  | 15 bits  | −16382       | 16383        | $6.48×10^{4{,}966}$  |
| binary256 | Octuple precision   | 237 bits  | 19 bits  | −262142      | 262143       | $2.25×10^{78{,}913}$ |

A ternary type would similarly be defined as a range plus a precision, but using the ternary base:

```clawr
type ternary27 = real(-1.5*3^121...1.5*3^121) sig 20 ter
```

This definition of `ternary27` comes from [a speculative document](./Ternary27.pdf) which unfortunately lacks attribution. It’s been in my possession for some time, and I do not remember where I found it.

> [!note]
>
> Note that the base keyword `ter` may already be used in user-defined types. All this ADR is debating is what _standard-library_ defined types should be added.

Extrapolating the pattern from `ternary27`, larger ternary types may be defined with increased precision and exponent ranges. The table below summarizes a possible series.

| type       | Precision | Exponent | Exponent max                         | Max value (approximate)                                     |
| ---------- | --------- | -------- | ------------------------------------ | ----------------------------------------------------------- |
| ternary27  | 20 trits  | 5 trits  | ${3^5-1 \over 2} = 121$              | $1.5 \times 3^{121} \approx 8.08 \times 10^{57}$            |
| ternary54  | 45 trits  | 7 trits  | ${3^7-1 \over 2} = 1{,}093$          | $1.5 \times 3^{1{,}093} \approx 4.67 \times 10^{521}$       |
| ternary81  | 70 trits  | 9 trits  | ${3^9-1 \over 2} = 9{,}841$          | $1.5 \times 3^{9{,}841} \approx 3.36 \times 10^{4{,}695}$   |
| ternary108 | 94 trits  | 11 trits | ${3^{11}-1 \over 2} = 88{,}573$      | $1.5 \times 3^{88{,}573} \approx 1.72 \times 10^{42{,}260}$ |
| ternary243 | 225 trits | 15 trits | ${3^{15}-1 \over 2} = 7{,}174{,}453$ | $1.5 \times 3^{7{,}174{,}453} \approx 10^{3{,}419{,}727}$   |

> [!warning] Speculative Table
>
> While `integer` subsets use reliably predictable ranges, the layout of ternary floating-point types is not standardized yet, and a future IEEE standard may settle on exponent and significand sizes that are different from these examples given here.

The 243-trit ternary type is extreme. It is unlikely to be used in typical applications due to its enormous size and computational requirements.

The 108-trit ternary type has an awkward size: $4 \cdot 3^3$. It might be expected for trit counts to follow a pattern of $3^k, 2 \cdot 3^k$ for $k \in \mathbb{N}$ only, avoiding sizes on the form $4 \cdot 3^k$. In other words: $27, 54, 81, 162, 243…$ skipping 108. Or maybe I’m just silly.

## Related ADRs

- [ADR-025](../adr-025.md) (Real representation and precision)
- [ADR-032](../adr-032.md) (`subset` and `type`)
