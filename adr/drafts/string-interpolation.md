&nbsp; / &nbsp; [Architecture Decision Records](../README.md) &nbsp; / &nbsp; [ADR Sketches](./README.md)

# String Interpolation and Multiline Strings

> Status: 🗳️ Idea

## Context

Many languages support interpolated strings.

```c#
var multiline = """
    This is a multiline string
    The indentation remains part of the string value
    """;
var interpolated = $"this is interpolated {s}";
var noescape = @"this\includes\all\backslashes\\\";
var decorated = @$"this\includes\backslashes\and\{interpolation}";
```

```swift
let multiline = """
    This is a multiline string
    The indentation is trimmed out of the string value
    """
let interpolated = "no special syntax is needed to activate \(interpolation)"
let manyQuotes = ##"""
    Swift adds a #"string"# syntax for including "unescaped quotes" in strings.
    Adding more # symbols allows for nesting #" and "# as well.
    """##
```

## Decision

```clawr

```

Embedded expressions must either be `string`s or convertible to `string` through the `HasStringRepresentation` trait.

## Rationale

## Alternatives Considered

## Consequences

### Positive

### Negative

## Related ADRs
