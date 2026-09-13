# No Stack Allocation (for now)

The per-variable semantics of Clawr means that a `LinkedList` type can be equivalent to `x:xs` in Haskell! A linked list can be declared as a monolithic structure.

As long as data is laid out with indirection (every substructure is a pointer), it is possible to define an entire structure (like a linked list) using a single literal expression.

```clawr
const linkedList: LinkedList = { value: 1, next: { value: 2, next: { value: 3, next: null } } }
```

(Maybe we need syntax sugar for linked lists?)

In languages like Swift, we need explicit indirection (`class` mutable sharing) or construction in multiple steps:

```swift
let tail: LinkedList = ( value: 3, next: nil )
let longerTail: LinkedList = ( value: 2, next: tail )
let linkedList: LinkedList = ( value: 1, next: longerTail )
```

Indirection would however preclude stack allocation. The backend would be more constrained. Or would it? Um… yes… probably.

Maybe it is possible to detect this and adorn the type with an indirection flag? In that case, the backend can still choose stack-allocation when that flag is not set. But that is pretty advanced analysis and not relevant for this version of the language. At this point, the backend is assumed to heap allocate.

> A backend on a stack-only target sees this attribute and knows: I can still stack-allocate the _outer_ node (it has a finite size), I just can't stack-allocate the whole spine. Which is exactly what you'd want anyway — the head node lives on the stack, its `next` boxes live wherever the backend wants.

Is it? I’m not sure. A `const` variable can be assigned to a field. If the variable is stack allocated, the value must be copied immediately, but if the field uses indirection, it can be assigned to other fields with copy-on-write. This sounds complicated, but maybe it is reasonable?

## What is `null`?

We will have to decide what `null` means or we cannot declare the end of a list.

Probably something like a `union Optional<T> { case null, case value: T }`. But to support that we need to define `union` and generics both.

Or should we not have `null` as a generic concept? Instead we could require the programmer to define each `null`-ness explicitly?

```clawr
union LinkedList = { value: integer, next: LinkedList } | end
```

Maybe a new concept — e.g. a `symbol` or a value-less `union`case — can represent absence generically without involving  formal generics? Then ?. and ?? can operate on unions that have such a case and a `subset` or a lattice can remove that option.
