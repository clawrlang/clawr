<!-- markdownlint-disable MD041 MD033 -->
<img src="../images/rawry.png" alt="Rawry" style="float: right; margin: 10px;">

# Unions and Enumerated Types

[ADRs](../README.md)

## Status

✍🏼 **Draft**

> A rough sketch of an idea

## Context

Languages often support enumerated types and sum-types (types that can take various values, yet remain “safe”). Swift e.g. supports “enums with associated values,” conflating the two concepts under one keyword. This might be good from their point of view, but not necessarily good for Clawr.

- In TypeScript: `Type '{}' is not assignable to type 'number' as required for computed enum member values.ts(18033)`
- Can that 'number' be its position in the declaration? Or its name (because strings work too)?

## Decision

Clawr will support two keywords: `enum` for simple enumerated values (maybe with a `string` representation) and `union` for sum-types (maybe with a tag to identify the current type).

A `union` type is a selection of different `data`structures rather than tuples.

There might also be use for a type (or “value-set”) that is simply an enumeration of constant values. Something like `enum HTTPVerb = 'GET' | 'POST' | 'PUT'`. Or maybe even something like this:

```clawr
const course1 = {...}
const course2 = {...}
const course3 = {...}

func enroll(course: course1|course2|course3) {
...
}
```

Maybe it couldn't work because the courses do not “exist” yet at compile-time, or perhaps it is still possible? TypeScript, after all, allows `typeof x` to define a type, and if `x` is declared `as const`, the resulting  type can be defined specifically in detail.

## Rationale

1. To conceptually separate simple enumerations from sum types.

## Alternatives Considered

- `enum` with associated values à la Swift.
- Java-like enums? — Complex objects with identifiers

## Consequences

### Positive

- Separating simple enumerations from sum-types emphasises intent

### Negative

- Serializing integers or case names (for enums without an explicit string representation) might be shaky.
- People might be used to Swift’s paradigm

## Related ADRs

- [ADR-011](../adr-011.md) (Ad Hoc Data Structures)
