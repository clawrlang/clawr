# Threads and Processes

[ADRs](../README.md) &#124; [Draft ADRs](./README.md)

## Status

✍🏼 **Draft**

> A rough sketch of an idea

## Context

## Decision

Async contexts (`service` and free functions only — should free functions be annotated to allow it?)

- `launchAsync(_: () -> void)` background threads
- Launch with parameters?
- `concurrent` = safe to execute in `async` context
- `async`/`await`
- `fork()`

## Rationale

## Alternatives Considered

## Consequences

### Positive

### Negative

## Related ADRs
