# Currying and Labels

Haskell has a feature called currying.

```haskell
map :: (a -> b) -> [a] -> [b]
map f list = -- ...

double :: [a] -> [b]
double = map (*2)

double [1, 2, 3] -- -> [2, 4, 6]
```

Currying can be a very nice feature, but it can also be awkward. Which is more readable?

```haskell
double_list = map (*2) [1, 2, 3] -- -> [2, 4, 6]
double_list = map [1, 2, 3] (*2) -- -> [2, 4, 6]
```

It might not be all that obvious in Haskell, but let's try this in Swift instead:

```swift
let doubledList = map({$0 * 2}, [1, 2, 3])

// Using labelled parameters (a Swift feature)
let doubledList = map(using: {$0 * 2}, [1, 2, 3])
let doubledList = map(using: {$0 * 2}, value: [1, 2, 3])

// Reversing the order is more readable:
let doubledList = map([1, 2, 3], using: {$0 * 2})

// With trailing closure syntax:
let doubledList = map([1, 2, 3]) {$0 * 2}

// (But Swift doesn't have syntax for currying.)
```

When parameters are labelled, it becomes very awkward to place the transformation function before the list (and it completely removes the option to use Swift’s training closure syntax), but it is necessary if currying can only fix the initial parameters.

Requiring curried parameters to be positioned first limits expressibility. It means that defining curried functions often becomes awkward. Or that using the same function *without* currying does.

## Clawr's Solution: Label-Based Currying

Like Swift, Clawr uses labelled parameters. This is believed to be the best compromise. Labelled parameters are not defined by their position, but by their label. Because of that, using them as curried parameters becomes natural:

```clawr
func mapInt(_ list: [integer], using transformation: (integer) -> integer) -> [integer]
const double: ([integer]) -> [integer] = mapInt(using: x => 2*x)

// Alternative syntax:
curry mapInt(using: x => 2*x) as double

// These are now equivalent:
const doubledList1 = mapInt([1, 2, 3], using: x => 2*x)
const doubledList2 = double([1, 2, 3])

func map<T, U>(_ list: [T], using transformation: (T) -> U) -> [U]
const double = map(using: (x: integer) => 2*x)
```

> [!tip] Key insight
> Since labeled parameters are identified by their label (not their position), they can be curried regardless of where they appear in the parameter list.

### Labels without Position

If an argument is defined by its label, its position becomes moot. While Swift is still strict when it comes to parameter ordering, other languages (Kotlin, Scala) have taken a different approach. And so does Clawr.

Since labelled parameters are not defined by position, they can be reordered. And this capability makes them particularly useful for currying. Unlike Haskell, Clawr does not curry the first parameters, but labelled parameters only. (And maybe Clawr should limit unlabelled parameters to the beginning of the parameter list as well — as early versions of Swift did).

```clawr
function labeledFunction(_ unlabeled: integer, a: integer, b: integer) {}

// These are equivalent:
labelledFunction(1, a: 2, b: 3)
labelledFunction(1, b: 3, a: 2)
```

### Rules

1. All unlabelled parameters must appear before any labelled parameters in the parameter list.
2. Unlabelled arguments must be provided at call time in parameter order.
3. Labelled arguments can appear in any order after the unlabelled arguments.
4. Only labeled parameters can be curried.
5. Curried functions preserve parameter defaults and optionality for unspecified parameters.

> [!note] Note on Terminology
> The above rules make a distinction between the terms *argument* and *parameter*:
> - A _parameter_ is a declared input to a function
> - An _argument_ is a value used for a specific parameter when calling the function

## Overloading

Function overloading is now label-dependent. Two functions with the same “base name,” and labels — just ordered differently — will have the exact same signature. That will trigger a compile-time error.

```clawr
func sameName(a: integer, b: boolean)
func sameName(b: boolean, a: integer) // Error: Repeated function signature
```

If they have the same types, but different labels, they are *different* signatures. And therefore distinct functions. In other words: the base name of a function is not fundamental; instead, its identifier is the base name *plus* the set of its labels!

```clawr
func differentName(a: integer, b: boolean)
func differentName(c: integer, d: boolean) // No error, different names
```

### Implementation Note

Clawr’s runtime implementation is written in C. While that can change in the future (e.g. to use an LLVM IR) — or grow into a zoo of backend implementations all targeting different hardware / OS architectures — the current recommendation is for functions to be given C names constructed from the base name and labels in the order they are declared in the source code. The parser/resolver reorders arguments in its AST output to match the declaration order before the backend is invoked.

It should also inject the curried arguments rather than creating runtime functions for each defined currying. 

Clawr source code:

```clawr
func f(_ a: integer, b: integer, c: integer) { ... }

curry f(b: 25) as b25

f(1, c: 10, b: 12)
b25(5, c: 3)
```

Generated C code:

```c
void f__b_c(int a, int b, int c) { ... }

f__b_c(1, 12, 10);
f__b_c(5, 25, 3);
```
