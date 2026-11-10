&nbsp; / &nbsp; [Architecture Decision Records](../README.md) &nbsp; / &nbsp; [ADR Sketches](./README.md)

# Auto Equality

## Status

> Status: 🗳️ Idea

## Context

In many programming languages, equality checks between objects often require manually implementing equality methods. This can be error-prone and tedious, especially for complex data structures. Automating equality checks can improve code reliability and reduce boilerplate code.

## Decision

We will implement a mechanism to automatically generate equality methods for objects based on their properties. This will ensure consistent and accurate equality checks without requiring manual implementation for each class or data structure.

If the programmer adds the `Equatable` trait to an `object` type, the system will automatically add `func equals(_ other: Self) -> truthvalue` based on the properties defined in the `state:` section. The programmer may still override the generated method if custom equality logic is required.

Similarly, if the programmer adds the `HashEquatable` trait to an `object` type, the system will automatically add `func hash(into hasher: ref HashBuilder)` as well as the `equals(_ other: Self) -> truthvalue` method. The hash method will be generated so that two `equal` objects will necessarily produce the same hash value. The programmer may still override the generated methods if custom hash code logic is required.

## Consequences

- Reduced boilerplate code for equality checks and hash code generation.
- Improved consistency between equality and hash code implementations.
- Increased reliability and consistency of equality comparisons.
- Potential performance overhead due to automatic generation and reflection-based checks.
- Simplified maintenance as changes to object properties will automatically be reflected in equality checks and hash code generation.
- May introduce challenges in debugging equality issues due to the automated nature of the generated methods.

## Alternatives Considered

- Manual implementation of equality methods for each class or data structure.
- Using third-party libraries or frameworks that provide automated equality generation.
- Leveraging language-specific features such as data classes or record types that automatically generate equality methods.
- Implementing a hybrid approach where critical classes have manually implemented equality methods while less critical ones use automated generation.

## Related ADRs

- [ADR-037](../adr-037.md) (Hashing and `HashEquatable`)
