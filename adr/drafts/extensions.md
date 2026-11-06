&nbsp; / &nbsp; [Architecture Decision Records](../README.md) &nbsp; / &nbsp; [ADR Sketches](./README.md)

# Extensions

> Status: 🗳️ Idea

## Context

Swift extensions allow you to add new functionality to existing classes, structures, enumerations, or protocols without modifying the original source code. This can be particularly useful for organizing code, adding convenience methods, or conforming to protocols in a modular way.

Extensions can also be used to add computed properties, define nested types, and provide default implementations for protocol methods. However, they cannot add stored properties or change the existing behavior of the type they extend. By leveraging extensions effectively, you can keep your codebase clean, maintainable, and flexible.

### Example

```swift
extension String {
    var reversedString: String {
        return String(self.reversed())
    }
}

let greeting = "Hello"
print(greeting.reversedString) // Output: "olleH"
```

### Retroactive Modeling

Swift extensions enable retroactive modeling, allowing you to add functionality to types for which you do not have the original source code. This is particularly useful when working with third-party libraries or system types, as you can extend their capabilities without modifying their implementation. Retroactive modeling promotes code reuse and helps maintain a clean separation of concerns.

### Example of Retroactive Modeling

```swift
protocol Describable {
    var description: String { get }
}

extension Int: Describable {
    var description: String {
        return "The number is \(self)"
    }
}

let number: Describable = 42
print(number.description) // Output: "The number is 42"
```

## Decision

Clawr will support extensions similar to Swift, allowing developers to add new functionality to existing types without modifying their original source code. This includes adding new methods and conforming to roles and traits. However, like Swift, Clawr extensions will not allow adding stored properties or altering the existing behavior of the type.

An extension cannot add conformance to already existing traits/roles to already existing types. It can only add conformance to types when either the type itself or the trait/role is defined in the current module. This ensures that the behavior and contracts of types remain predictable and consistent throughout the codebase.

## Consequences

### Positive

- Promotes modularity by ensuring that extensions are only applied within the context of the current module.
- Reduces the risk of conflicts and ambiguities arising from multiple extensions in different modules.
- Encourages explicitness and clarity in type modifications, making the codebase easier to understand and maintain.

### Negative

- Limits the flexibility of extensions, as developers cannot add trait or role conformance to types and traits defined entirely in other modules.
- Can make it harder to extend third-party types in a seamless way, potentially limiting interoperability with external libraries.

## Rationale

By restricting extensions to only add trait or role conformance when either the type or the trait/role is defined in the current module, Clawr avoids potential conflicts and ambiguities that could arise from conflicting extensions in different modules. This design choice promotes modularity, maintainability, and predictable behavior across the codebase.

Additionally, this approach aligns with the principle of explicitness in Clawr, ensuring that any modifications to type behavior are clearly defined within the module where the type or trait/role is introduced. This reduces the risk of unexpected side effects and makes the codebase easier to understand and reason about.

By following these guidelines, Clawr maintains a balance between flexibility and safety, allowing developers to extend types in a controlled manner while preserving the integrity and predictability of the overall system.
