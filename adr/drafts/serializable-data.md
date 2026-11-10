&nbsp; / &nbsp; [Architecture Decision Records](../README.md) &nbsp; / &nbsp; [ADR Sketches](./README.md)

# Serializable Data

## Status

> Status: 🗳️ Idea

## Context

In many programming languages, serializing and deserializing data structures often requires manually implementing serialization methods. This can be error-prone and tedious, especially for complex data structures. Automating serialization can improve code reliability and reduce boilerplate code.

## Decision

All `data` structures will automatically be serializable and deserializable without any additional effort from the programmer.

## Rationale

A `data` structure is a simple container of exposed data elements, typically used as DTO (Data Transfer Object). A data structure that cannot be serialized would defeat its primary purpose of facilitating data transfer, hence the need for automatic serialization support. In Clawr, a `data` structure also does not have behavior or methods unless added by extension, which can be awkward.

## Related ADRs

- [ADR-008](../adr-008.md) (Encapsulation vs Data)
