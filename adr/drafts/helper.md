# `helper` Keyword

[ADRs](../README.md)

## Status

✍🏼 **Draft**

> A rough sketch of an idea

## Context

Object-oriented languages typically have a complex array of visibility modifiers: `private`, `internal`, `public`, `protected`, `fileprivate`…

## Decision

Clawr will only have one modifier: `helper`. Sensible defaults apply where some structures are always hidden and some are necessarily publicly accessible. Other elements are accessible by default, but can be hidden by adding the `helper` tag.

- A `data` type necessarily exposes all its fields. They cannot be hidden.
- An `object`/`service` type always hides its fields. They can only be accessed from the body of one of the type’s methods.
- Methods are visible by default, but can be marked `helper`. A method marked `helper` can only be invoked by other methods on the owning type.
- A type of any kind is visible by default. A `helper` type can only be accessed from inside its containing package (module?).

## Rationale

- Pluralistic visibility modifiers can be powerful, but also confusing. If a single keyword is enough, we should not complicate the story.
- This might turn out to be too restrictive, but it is probably better to add more keywords as needed rather than jumping the gun.
- The philosophy of [ADR-008](../adr-008.md) makes visibility keywords redundant. Hiding a `data` field would make the type impossible to instantiate. And directly exposing an `object` field would break encapsulation, invalidating the entire purpose of the keyword.

## Related ADRs

- [ADR-008](../adr-008.md) (Encapsulation vs Data)
