<!-- markdownlint-disable MD041 MD033 -->
<img src="../images/rawry-150.png" alt="Rawry" style="float: right; margin: 10px;">

# Architecture Decision Records

**ADRs** are design documents used to capture important architectural decisions and the reasoning behind them. They typically document:

- **What decision was made** (e.g., choosing a specific framework, database, or architectural pattern)
- **Why it was chosen** (the context and rationale)
- **What alternatives were considered**
- **The consequences or implications** of that choice
- **The status** (proposed, accepted, deprecated, etc.)

In the case of Clawr, the language itself is considered architecture. [ADR-004](./adr-004.md) defines the Clawr architecture as being made up of a frontend, a backend and a protocol (the CIR) for communicating between them. The syntax and semantics of the language is important for this architecture. There is other documentation for [learning](../tutorials/README.md) and a [language reference](../lang-reference/README.md), but they do not explain *why* the language works as it does.

Many design decisions are made implicitly by the TDD principle “make it work.” [^make-it-work] Those decisions are not documented here. When something interesting is learned requiring the design to change, that’s when the decision should be documented. The old solution should be listed under *Alternatives Considered* if not in the earlier sections.

[^make-it-work]: “Make it work. Make it right. Make it fast.” The principle indicates a priority: if it does not work, efficiency is moot, so the first priority must be to make “it” work. (It also says that designing for readability and maintainability is more important than designing for runtime performance.)

Statuses used in this documentation:

- 💡 **Proposed**: A proposed idea
- ✅ **Adopted**: Principle is in use in the ecosystem, or the feature has been implemented in the example implementation
- ❌ **Rejected**: Not considered a good fit for Clawr
- 🔄 **Superseded**: Another decision has made it obsolete

Records so far:

- [ADR-000](./adr-000.md): Platform Agnostic Language
- [ADR-001](./adr-001.md): Per-Variable Semantics
- [ADR-002](./adr-002.md): Encapsulation vs Data
- [ADR-003](./adr-003.md): Ternary Fields on Binary Hardware
- [ADR-004](./adr-004.md): Syntax, Semantics and CIR
- [ADR-005](./adr-005.md): Unions and Enumerated Types
- [ADR-006](./adr-006.md): Ad Hoc Data Structures
- [ADR-007](./adr-007.md): Serializable `data`
- [ADR-008](./adr-008.md): Protocol Types
