# What is `null`?

Probably something like a `union Optional<T> { case null, case value: T }`. But to support that we need to define `union` and generics both.

Or maybe `null` is not a primitive/generic concept at all? Maybe it is domain-specific?

---

> [!question] AI Prompt
>
> Clawr operates on lattices. It tries to limit the set of values each expression can take by analysing its context. The `truthvalue` type is a lattice with three states (`false`, `ambiguous`, `true`). There is no Boolean type, instead it is defined as a `subset boolean = truthvalue(false|true)`.
>
> So a not-nullable variable could be defined as a `LinkedList` but excluding the `end` case. With the ADT declaration used above that would be `const x: { value: integer, next: LinkedList }`, which would amount to an anonymous type. One alternative is to define a “minus” set syntax, maybe: `const x: LinkedList(\ end)`. Another is to add labels to all the cases and list them in the lattice declaration: `const x: LinkedList(node)`.

This is a beautiful reframing. The lattice/subset approach turns the null question into something much more general and, I think, much more Clawr-native. Let me work through it.

**The core insight:** you don't need a special "nullable" concept or a special "Optional" type. You need subsetting over a lattice, and a union is just a lattice whose elements are the cases. A "non-null LinkedList" is just a subset of the LinkedList lattice that excludes the `end` case. `boolean` is a subset of `truthvalue`. The same machinery does both. That's a genuinely unifying move — one feature (`subset` over lattices) subsumes nullability, booleans, and probably a lot of other things you'd otherwise design separately.

**On the three syntax options you sketched:**

1. **Anonymous structural type:** `const x: { value: integer, next: LinkedList }` — this is the "spell out the shape" approach. It works and it's compositional, but it's _structural_, not _nominal_, and it duplicates the case list in two places. If you add a field to `LinkedList`'s node case, this breaks silently or diverges. It also loses the domain name `node`, which matters for readability and for error messages.

2. **Minus-set syntax:** `LinkedList(\ end)` — reads as "LinkedList with `end` removed." This is _nominal_ (you name the type, then subtract), it's local (the exclusion is visible at the use site), and it's tolerant to adding new cases later: if you add a `dangling` case, the type `LinkedList(\ end)` automatically includes it, which is almost certainly what you want. The downside is that the syntax feels algebraic/mathematical, which is a stylistic call. It's also unbounded in what you can express: `LinkedList(\ end, dangling)` etc., which is a feature if you want it and a footgun if you don't.

3. **Case labels with subset by inclusion:** `const x: LinkedList(node)` — this says "LinkedList, only the `node` case." This is the most explicit and reads best if cases are already labeled. It's symmetric with your `truthvalue(false|true)` syntax, which is a real win: `truthvalue(false|true)` and `LinkedList(node)` are the _same operation_ (pick a subset of cases) with the same spelling. That consistency is worth a lot. The downside is that it reads as a whitelist rather than a blacklist, so adding a new case _narrows_ the type rather than widening it — which is arguably wrong for the common "everything except the terminal case" situation. E.g., if you add `corrupt` to `LinkedList`, `LinkedList(node)` still means "only node," and any code that was relying on "any non-terminal case" now has to be updated.

**The choice between (2) and (3) is really "blacklist vs. whitelist," and they answer different questions:**

- `LinkedList(\ end)` says "anything that isn't `end`." Survives adding cases gracefully.
- `LinkedList(node)` says "specifically `node`." Precise, but brittle to schema evolution.

You probably want _both_, because they're useful in different contexts. A "definitely has a next field" type wants the minus form; a "specifically a node with these properties" type wants the plus form. If you only ship one, I'd ship the minus form for this specific case, because "the list ends" is exactly the kind of terminal case you want to subtract out and forget about. But if you're already committed to `truthvalue(false|true)` as the subset syntax, then adding `\` as a second operator is a real inconsistency to justify.

**There's a third path worth considering:** make `truthvalue(false|true)` and `LinkedList(\ end)` _the same syntax_. I.e., `LinkedList(node|value)` is inclusion, and `LinkedList(\ end)` is the same as `LinkedList(node)` when there are only two cases. Then you don't have two subset operators — you have one, and `\` is just sugar over it when the complement is shorter. This is what some type systems do with "or" and "not" over finite sets. It keeps the syntax consistent while letting you write the more readable form in the common case.

**Now the deeper design question this raises, which I think is the interesting one:** should _every_ union case be labeled by default, or only when the programmer asks?

If labels are mandatory, `LinkedList(\ end)` and `LinkedList(node)` both work, and error messages are better ("expected a LinkedList node, got end"). If labels are optional, you can't do case-by-case subsetting without them, so you'd need to either require labels for subsettable types or fall back to the structural form. Given that you want to subset, I'd say **labels should be mandatory on union cases**. It's a small syntactic cost and it unlocks the lattice operations you actually care about.

**What this buys you architecturally:**

- `truthvalue` and `LinkedList` and every other union are handled uniformly. No special nullable machinery in the type checker or the CIR.
- The "non-null" concept is _derived_: it's a subset that happens to exclude the terminal case. The frontend can compute it, but it isn't a primitive.
- Generics stay deferred, because `LinkedList(\ end)` doesn't need them. `Optional<T>` still doesn't exist, but you don't need it — you have `LinkedList(\ end)` and, more generally, "any union minus its terminal case."
- The lattice analysis you already have (to narrow `truthvalue` based on context) generalizes directly: narrowing a `LinkedList` to exclude `end` is the same kind of flow-sensitive narrowing you'd do for booleans. This is likely a big win, because it means the type system has _one_ narrowing story, not two.

**The thing I'd watch:** if subsets are first-class, you can construct very specific types (`LinkedList(node, dangling)` etc.) that may not have meaningful names. At some point you'll want a way to _name_ a subset so you can reuse it — `subset NonEmptyList = LinkedList(\ end)` or similar. You already have `subset` for `boolean`, so extending it to user-defined unions is natural and probably worth planning for even if you don't ship it in v1.

**My recommendation:** Go with labeled union cases and the minus-set syntax as the primary form, with inclusion as an equivalent spelling (or the same syntax with `\` as complement sugar). It's the option that best fits the lattice/subset philosophy you've already committed to, and it makes `null` a non-issue — there's no null, there's just a case you can choose to exclude. That's a much stronger foundation than either "primitive null" or "special-cased Optional type," and it does it without needing generics.

The one thing I'd want to nail down in an ADR before committing: **what does "subset" mean when the underlying lattice is not a flat union?** `truthvalue` is a flat three-element lattice, so `(false|true)` is easy. Is every union a flat lattice, or can unions nest? If `LinkedList`'s `node` case contains another union, does `LinkedList(node)` mean the case is present, or that the case is present _and all its sub-cases are present_? That distinction will matter, and it's the kind of thing that's cheap to decide now and expensive to change later.
