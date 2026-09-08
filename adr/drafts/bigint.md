<!-- markdownlint-disable MD041 MD033 -->
<img src="../images/rawry.png" alt="Rawry" style="float: right; margin: 10px;">

# The `integer` Combinatorial Explosion

[ADRs](../README.md)

## Status

✍🏼 **Draft**

> A rough sketch of an idea

## Context

Large `integer` values need to be lowered as `Integer*` (arbitrary size). But sometimes the right thing to do is to optimize and use only a byte or an `int64_t`. Differently lowered integers are likely to interact a lot of the time. That can cause combinatorial explosion of necessay implementations.

## Decision

The backend tracks how it has chosen to lower each variable and function. The CIR only contains the promised range of the expression `value`.

The backend has four (ish) implementations of each operator: `Integer* + Integer*`, `Integer* + int64_t`, `int64_t + Integer*` and `int64_t + int64_t`, where `int64_t` is a placeholder for any fixed size.

C already knows how to add `int64_t` and `byte`. It can handle whatever size the two inputs have. When involving `Integer*`, it can use `int64_t` or `uint64_t`. For commutative operators (like `+` and `*`), it only needs one implementation — in can simply swap the operands as necessary. For other operations four implementations might be needed, unless the fourth variation is trivial.

Dividing a smaller number with a larger number is trivial for example. The result is zero. So `int64_t / Integer*` will not need its own implementation.

The `Integer*` could still be implemented as a `union` type. If the value is small, the value is just an `int64_t`. If it is too big to fit in `int64_t`, it is converted to a list of `uint64_t` digits.

When a variable, function etc is lowered, it should have a type that fits the entire declared range. If that range is small, the type should just be a simple fixed-width type. If it is too wide to fit in `int64_t` or `uint64_`, it should be a `union` type such that if the _actual_ value is small, it is limited to `int64_t` plus a discriminator symbol. If it is too large to fit, it becomes a pointer to an `Integer`. (Actually: the `Integer` type itself could be redesigned as a `union`.)

## Rationale

## Alternatives Considered

- A `union` type with a discriminator value that selects between `int64_t` or a pointer.
- Polluting the CIR with multiple lattices for each expression.

## Related ADRs

---

> [!question] AI Prompt
>
> In languages that support big integers, do they ever automatically optimize storage for small values as Clawr does?
>
> I was thinking that it might get very complicated for a Clawr backend if small values are sometimes stored as `byte` and sometimes as `int64_t` etc when they need to be added/multiplied/assigned to a `Integer*` variable (arbitrary size) — and then when it happens in the opposite direction: when an unlimited `integer` variable that is proven to currently contain a small enough value is assigned to a `byte` or `int64_t` variable.
>
> What do existing languages do in this case? Do they have tens to hundreds of C functions in their runtime to handle all possible combinations of integer inputs — for all integer operators?

---

Yes — several languages do exactly this, and it's a well-trodden pattern. It's worth distinguishing two different things that go by similar names, because I think they map onto two different parts of what you're worried about.

## Languages that promote/demote integer storage transparently

**Common Lisp / Scheme** is the classic case: `fixnum` (fits in a machine word, often stored as a tagged pointer — no heap allocation at all) and `bignum` (heap-allocated, arbitrary precision). `+` is a single generic function. Internally it checks the tags of both operands, does the fixnum+fixnum path with an overflow check, and only falls into the bignum path if either operand already is one or the fixnum add overflows. Critically, on overflow it _promotes_, and if a bignum operation produces a result that fits back in a fixnum, some implementations _demote_ it back down.

**Smalltalk** does the same with `SmallInteger` vs `LargePositiveInteger`/`LargeNegativeInteger`.

**Ruby** used to have `Fixnum`/`Bignum` as distinct classes (unified into a single `Integer` class in 2.4, but the underlying tagged/heap split is still there under the hood — it's just hidden from the user now, which is closer to what you want).

**GHC Haskell**'s `Integer` type is maybe the closest analogue to your `integer` type: internally it's a sum type with an `IS` constructor holding a machine-word `Int#` for the small case, and `IP`/`IN` constructors holding a `ByteArray#` (GMP-style limbs) for big positive/negative values. Every arithmetic op pattern-matches on the constructor.

**CPython**, by contrast, does _not_ do this — every `int` is always the variable-length representation (array of 30-bit "digits"), even for the value `1`. What people call Python's "small int optimization" (-5 to 256) is a completely different thing: it's _object identity caching_ to avoid allocation/refcounting churn for common small values, not a storage-width optimization. Worth flagging since it's a common conflation.

## The combinatorial explosion problem — how they actually avoid it

Your worry is legitimate in the abstract but the trick every one of these runtimes uses is to **not** have N storage widths. They collapse to exactly two classes:

1. "fits in a machine word" (fixnum) — often not even a distinct type, just a tagged value
2. "doesn't fit" (bignum) — heap-allocated, arbitrary width

So a binary operator only ever needs to handle 2×2 = 4 cases (fix/fix, fix/big, big/fix, big/big), not a cross product of byte/int16/int32/int64/bignum. The fix/fix case does the arithmetic in a machine register with an overflow-checked intrinsic (`__builtin_add_overflow` and friends in C, or the equivalent CPU flag check), and only escalates to the bignum path on overflow. GMP itself internally special-cases 1-limb and 2-limb operands for the same reason — the general "N-limb by M-limb" routine is only invoked when both operands are already known to be multi-limb.

## Why this maps differently onto Clawr

Your `types.md` describes something subtly different from the Lisp/Scheme runtime-tagged model: you want the _compiler_ to pick a fixed-size representation when the range is statically provable (`age: integer @range(0..150)` → a byte, decided at compile time, no tag, no runtime dispatch at all), and fall back to the arbitrary-precision path only when it can't prove a bound. That's actually closer to **Ada**'s range-constrained integer model than to Lisp's fixnum/bignum — except Ada never auto-promotes to a bignum; a proven-impossible-to-verify-statically overflow is just a runtime `Constraint_Error`. You're proposing Ada's static-sizing plus Lisp's dynamic-fallback, which I don't think has a direct precedent, but it's not building on nothing.

For the _backend_ function-explosion question specifically: you don't need a function per concrete width pair (byte+int64, int32+bignum, etc.) any more than C needs one — C's "usual arithmetic conversions" already solve this by promoting both operands to a common width before the op. Your frontend can do the analogous thing: whenever it can prove both operands fit some common fixed width, emit ordinary fixed-width arithmetic (letting the C backend's usual promotion rules handle byte+int64 the normal C way); the only genuinely new runtime surface you need is the single boundary case — "prove-failed" — which routes to your arbitrary-precision path, exactly like the Lisp overflow-check triggers a bignum promotion. So it's not tens of functions per pair of widths; it's your existing fixed-width codegen plus one dynamic escape hatch, mirroring the fix/big split rather than a full N×N matrix.

If you want, I can sketch what that escape-hatch boundary would need to look like in CIR terms (something like a `PROMOTE_TO_BIGINT` node parallel to your existing `PROMOTION`/`BOX` family) — happy to when you're ready, no rush.
