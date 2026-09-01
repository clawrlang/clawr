# Inspirations from Ada

Ada is named for Ada Lovelace, the assistant to Charles Babbage in the design of the [Analytical Engine](https://en.wikipedia.org/wiki/Analytical_engine).

> \[Lovelace] was the first to recognise that the machine had applications beyond pure calculation. \[She] is often considered to be the first computer programmer.
> —<https://en.wikipedia.org/wiki/Ada_Lovelace>

In Ada, you can specify types as ranges.

```ada
type Score is range 0 .. 1_000_000;
```

This feature is perfect for defining [domain primitives](https://software.sawano.se/2017/09/domain-primitives.html). Domain-driven design (DDD) uses [value objects](https://www.milanjovanovic.tech/blog/value-objects-in-dotnet-ddd-fundamentals) for two main purposes: on the one hand it allows for consistent computations, and on the other is supports fail-fast validation, and security by design. *Domain primitives* is a term for the latter.

In Clawr, domain primitives can be defined using a syntax that is inspired by Ada’s ranged types:

```clawr
subset EntityId = string @matching(/^a-z0-9$/g) @maxlength(256)
subset Version  = integer @min(0) @max(2_147_483_647) // This fits in 32 bits
```

The compiler automatically injects range checking as necessary so that you do not need to worry about the implementation details. You can focus on modelling your domain.

This syntax is not limited to *named* subsets, but can be applied ad hoc on a per-variable basis:

```clawr
mut personnummer: string @matches_swedish_personnumber // custom matcher (aspirational)
mut age: integer @within(18..100)
mut password: string @min_length(16) @matches(/[ !"#$%&'()*+,-./:;<=>?@[\\\]^_`{|}~]/)
```

If that is not enough for your use-case, you can always define types the traditional way:

```clawr
object Prime {
    func value() => self.value
    data: value: integer
}

companion Prime {
  func new(value: integer @min(2)) throws -> Prime {
    guard isPrime(value) or fail NotPrime(value)
    return { value: value }
  }
}
```

## Packing

Ada also allows packing multiple variables into a single register.

```ada
type Register is record
   Flag   : Boolean;
   Value  : Integer;
end record;

for Register use record
   Flag  at 0 range 0 .. 0;
   Value at 0 range 1 .. 32;
end record;
```

Clawr will perform this packing implicitly so that you as programmer do not need to worry about the details. All you need to do is give permission by using the `@packable` annotation.

If you specify ranges for variables in a `data` structure or the `data:` section of an `object`, the compiler will know how many bits each field needs, and if the total size is small enough, the fields will be packed together.

```clawr
@packable
data DeviceStatus {
    isActive   : boolean
    errorCode  : integer [0...65_535]
    flags      : bitfield @count(12) @MASK(0xFFF)
    maybeflags : tritfield @count(3) @MASK(0tUUU) // only on ternary archs
}
```

In this example, the entire structure fits in 1 + 16 + 12 bits, and a register is 64 bits, so it can and will be packed accordingly. The `@packable` annotation gives the compiler permission to perform the packing. Permission can also be granted more generally by an optimisation setting.

---
---

> [!question] AI Section

## `real` Range and Precision

Your idea is excellent! Yes, there are more expressive ways to specify floating-point precision beyond just single/double/quadruple.

## Decimal Digits Approach

The most intuitive approach is to specify **decimal digits of precision**, similar to Ada's approach:

```ada
type Confidence is digits 6 range 0.0 .. 1.0;
type Temperature is digits 15 range -273.15 .. 1.0E7;
```

The relationship to bits depends on whether you're using:

- **Binary floating-point**: $\text{bits} \approx \lceil \text{digits} \times \log_2(10) \rceil \approx \lceil \text{digits} \times 3.322 \rceil$
- **Decimal floating-point**: More direct mapping (IEEE 754-2008 decimal types)

## For Clawr Syntax

You could offer multiple expressive options:

```clawr
// Specify decimal precision
var temperature: real @digits(15) @within(-273.15..1e7)

// Specify binary precision explicitly
var coordinate: real @precision(53) // 53 bits = double precision mantissa

// Specify relative error tolerance
var measurement: real @relative_error(1e-6) // ±0.0001% accuracy

// Specify absolute error tolerance  
var position: real @absolute_error(0.001) @within(-180.0..180.0)

// Or use standard types as shortcuts
var simple: real @single    // equivalent to @digits(6-9)
var precise: real @double   // equivalent to @digits(15-17)
var ultra: real @quadruple  // equivalent to @digits(33-36)
```

## Bit Calculation

For binary floating-point, the mantissa bits needed for $d$ decimal digits:

$$\text{mantissa-bits} = \lceil d \times \log_2(10) \rceil \approx \lceil d \times 3.3219280949 \rceil$$

And for ternary floating-point:

$$\text{mantissa-trits} = \lceil d \times \log_3(10) \rceil \approx \lceil d \times 2.09590327429 \rceil$$

Total bits also need exponent and sign:

- **Single**: 1 sign + 8 exp + 23 mantissa = 32 bits (6-9 decimal digits)
- **Double**: 1 sign + 11 exp + 52 mantissa = 64 bits (15-17 decimal digits)
- **Quadruple**: 1 sign + 15 exp + 112 mantissa = 128 bits (33-36 decimal digits)

## Packing Considerations

For your `@packable` feature, you could also support **reduced-precision floats**:

```clawr
data @packable SensorReading {
    timestamp: integer @min(0) @max(2_147_483_647)  // 32 bits
    value: real @digits(4) @within(0.0..100.0)      // ~16 bits (half precision)
    confidence: real @digits(2) @within(0.0..1.0)   // ~8 bits (minifloat)
}
```

This gives you the expressive power to match your domain requirements while letting the compiler optimize storage!

## `decimal`

Yes, you should definitely add a `decimal` type! It serves a distinct purpose from binary floating-point.

## Why `decimal` is Important

The key difference isn't just the exponent base—it's about **exact decimal representation**:

```clawr
// Binary float - WRONG for money!
var price: real = 0.1 + 0.2  // Actually 0.30000000000000004

// Decimal - correct for money
var price: decimal = 0.1 + 0.2  // Exactly 0.3
```

Financial calculations, currencies, percentages, and tax rates **require** exact decimal arithmetic. Binary floats accumulate rounding errors that are unacceptable in these domains.

## C# `decimal` Implementation

You're right about C#'s approach:

- **96-bit mantissa** (stores as integer)
- **8-bit scale** (power of 10: divides mantissa by 10^scale)
- **1-bit sign**
- Range: ±7.9×10^28 with 28-29 significant digits

This is _similar_ to IEEE 754 decimal but predates it (C# decimal is from .NET 1.0 in 2002, IEEE 754-2008 added decimal later).

## Clawr Type System

I'd suggest offering both with clear semantics:

```clawr
// Binary floating-point (fast, approximate)
var temperature: real @digits(15)
var coordinate: real @double

// Decimal floating-point (exact decimal, slower)
var price: decimal @digits(28)
var taxRate: decimal @within(0.0..1.0)
var currency: decimal @scale(2) @within(0.0..1_000_000.0)  // cents precision

// Domain-specific type
typealias Money = decimal @scale(2) @min(0)
```

## Annotations for `decimal`

The `@scale` annotation is particularly useful for decimals:

```clawr
var dollars: decimal @scale(2)   // exactly 2 decimal places (cents)
var bitcoin: decimal @scale(8)   // satoshi precision
var percent: decimal @scale(4)   // basis points
```

This lets the compiler optimize storage (fewer scale bits needed) while maintaining exact semantics.

## Summary

- `real` = binary float (fast, for science/graphics)
- `decimal` = decimal float (exact, for money/business)

Both need range/precision annotations, but `decimal` benefits from `@scale` since decimal places are its primary use case.

## Arbitrarily Large `integer`

Great question! Many languages support arbitrary-precision integers (often called "bignums" or "bigints").

## Languages with Unlimited Integers

**Default arbitrary precision:**

- **Python**: `int` is unlimited by default (switched in Python 3)
- **Ruby**: `Integer` automatically promotes
- **Scheme/Racket**: Exact integers are unlimited
- **Haskell**: `Integer` type (vs bounded `Int`)
- **Common Lisp**: `integer` type
- **Raku (Perl 6)**: `Int` is arbitrary precision

**Explicit bigint types:**

- **Java**: `BigInteger` class
- **C#**: `BigInteger` struct
- **JavaScript**: `BigInt` type (suffix `n`)
- **Rust**: `num_bigint` crate
- **Go**: `math/big.Int`

## How They Work

Under the hood, arbitrary-precision integers typically use:

1. **Array of "limbs"** (chunks of 32 or 64 bits)
2. **Dynamic memory allocation** as number grows
3. **Sign bit** separate from magnitude
4. **Optimized algorithms** (Karatsuba multiplication, etc.)

Example conceptual structure:

```
BigInt {
    sign: bool,
    limbs: Vec<u64>,  // [least significant ... most significant]
}
```

For `12345678901234567890`:

- Too big for 64-bit
- Stored as multiple limbs: `[0xeb1f0ad2, 0xab54a98c]` (hypothetically)

## Performance Characteristics

- **Small values**: Often optimized with inline storage (≤64 bits stored directly)
- **Large values**: Heap allocated, O(n) to O(n²) operation costs
- **Trade-off**: Convenience vs speed

## Your Design Decision for Clawr

Your idea is excellent and aligns with modern language design:

```clawr
// Arbitrary precision (default)
var factorial: integer = 1
for i in 1..100 {
    factorial *= i  // Will grow as needed
}

// Fixed-size optimization (explicit)
var index: integer @range(0..4_294_967_295)  // compiler uses u32
var counter: integer @within(0..255)         // compiler uses u8
```

This gives you:

- **Safety by default** (no overflow)
- **Performance when needed** (explicit ranges)
- **Clear intent** (ranges document domain constraints)

## Alternative: Make it Explicit

Some languages make you choose upfront:

```clawr
// Option A: Different types
var big: bigint = factorial(100)
var small: int32 = 42

// Option B: Your approach (better IMO)
var big: integer = factorial(100)           // unlimited
var small: integer @range(0..2_147_483_647) // 32-bit
```

**I prefer your approach** because:

1. Safety by default (matches Python, Ruby philosophy)
2. Optimization is opt-in via annotations
3. Consistent with your range-based domain primitives
4. The compiler can often infer when fixed-size is safe

## Compiler Optimizations

The compiler could be smart about inference:

```clawr
// Compiler sees loop bound, can use fixed size
for i: integer in 0..100 {  // compiler uses u8
    print(i)
}

// Compiler sees potential overflow, uses bigint
var fib: integer = fibonacci(1000)

// Explicit range helps compiler choose storage
func clamp(value: integer @within(-128..127)) -> integer {
    // compiler knows i8 suffices
}
```

This gives programmers the best of both worlds: safety and performance.