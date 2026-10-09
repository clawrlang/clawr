# Terminology in this Documentation

## Entity

A structure in memory that can be referenced by one or more variables. An entity — in this documentation – can be mutable of immutable, `SHARED` or `ISOLATED`, and naked of encapsulated.

In this documentation, anything that can hold at least two primitive values at the same time is an *entity*.

## Field

An ordered collection of truth-value fields that are operated upon as a single unit. Not to be mistaken with [property](#property).

In C and its descendants, any integer value may be operated upon as a collection of positioned raw `boolean` values (bit-wise operations). In Clawr, that is a different type from `integer`.

## `ISOLATED`

A variable is *isolated* if changes to other variables cannot affect it, and changes to it cannot affect other variables. The value referenced by the variable `MAY` be a reference-counted [entity](#entity), and it may be referenced by many variables. If it does, that entity `MUST`be copied before any mutation to it can be allowed, thereby preserving isolation. Because a value cannot both be copied and not copied before mutation, the value itself is also considered `ISOLATED`.

The antonym for `ISOLATED` is [`SHARED`](#shared).

## Property

A named data element belonging to an [entity](#entity).

Unlike C# and Kotlin, a *property* is not accessor-backed in Clawr. Reading or writing it does not invoke a getter or a setter, and it has no computed form. The prior art usage of the term is not useful here.

The term is used instead of “field” only to avoid confusion with binary and ternary [fields](#field).

## `SHARED`

A `SHARED` value is a reference-counted [entity](#entity) that may be referenced by multiple variables. The entity is *shared* if changes performed through any one variable immediately updates what the other references “see.” A `SHARED` entity `MUST NOT` be copied implicitly.

The antonym for `SHARED` is [`ISOLATED`](#isolated).
