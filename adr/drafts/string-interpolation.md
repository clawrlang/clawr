&nbsp; / &nbsp; [Architecture Decision Records](../README.md) &nbsp; / &nbsp; [Drafts](./README.md)

# String Interpolation and Multiline Strings

> Status: ✍🏼 Draft

## Context

Many languages support interpolated strings.

```c#
var multiline = """
    This is a multiline string
    The indentation is part of the string value
    """
var interpolated = $"this is interpolated {s}"
var noescape = @"this\includes\all\backslashes\\\"
```

```swift
let multiline = """
    This is a multiline string
    The indentation is trimmed out of the string value
    """
let interpolated = "no special syntax is needed for \(interpolation)"
let manyQuotes = #"this ##string## includes many "quotes""#
```

## Decision

```clawr
```

## Rationale

## Alternatives Considered

## Consequences

### Positive

### Negative

## Related ADRs
