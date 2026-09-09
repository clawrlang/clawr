# Weak References

[ADRs](../README.md)

## Status

✍🏼 **Draft**

> A rough sketch of an idea

## Context

Reference cycles cause memory leaks.

There is already an `__rc_proxy` type in the backend code anticipating the need for weak references.

## Decision

Add the keyword `weak` for use with fields: `weak ref`/`weak mutref`.
Also allow `weak` references in closures.

A `weak` reference does not claim the value it points at. The memory can be deallocated causing the `weak` reference to be set to `null`.

## Rationale

- Allows the programmer to break reference cycles
- Allows memory to be reclaimed
