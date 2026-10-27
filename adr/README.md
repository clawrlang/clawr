# Architecture Decision Records

**ADRs** are design documents used to capture important architectural decisions and the reasoning behind them. They typically document:

- **What decision was made** (e.g., choosing a specific framework, database, or architectural pattern)
- **Why it was chosen** (the context and rationale)
- **What alternatives were considered**
- **The consequences or implications** of that choice
- **The status** (proposed, accepted, deprecated, etc.)

[ADR-001](adr-001.md) defines the Clawr architecture as being made up of a frontend and a backend, with a data structure (the CIR) for communicating between them. But I
in the case of Clawr, the language itself is considered “architecture.” That is, the design of the language is a fundamental part of the system's architecture. The syntax and semantics are important enough to be documented as ADRs. There is other documentation for [learning](../tutorials/README.md) and a [language reference](../lang-reference/README.md), but they do not explain _why_ the language works as it does.

Many design decisions are made implicitly by the TDD principle “make it work.” [^make-it-work] Those decisions are not documented here. When something interesting is learned requiring the design to change, that’s when the decision should be documented. The old solution should be listed under _Alternatives Considered_ and/or in the earlier sections.

Also not documented here are several [sketches of future ADRs](./drafts/README.md). They are ideas that have not yet been fully developed or assigned a number. They are perhaps mostly an icebox to keep the TODO list manageable.

[^make-it-work]: “Make it work. Make it right. Make it fast.” The principle indicates a priority: if “it” does not work, efficiency is moot, so the first priority must be to “make it work.” (But this principle is not an excuse to be neglectful.)

The guiding principles for Clawr can be found in the [Tenets](./tenets.md) document.

Terminology used in this documentation can be found in the [Terminology](./terminology.md) document.

Statuses used in this documentation:

- ✍🏼 **Draft**: A rough sketch of an idea
- 💡 **Proposed**: An idea to be considered for adoption
- ✅ **Adopted**: Principle is in use in the ecosystem, or the feature has been implemented in the example implementation

The following ADRs have been documented so far:

- [ADR-000](./adr-000.md): Platform Agnostic Language
- [ADR-001](./adr-001.md): Syntax, Semantics and CIR
- [ADR-002](./adr-002.md): Per-Variable Isolation
- [ADR-003](./adr-003.md): `UNIQUE` Return Values
- [ADR-004](./adr-004.md): `UNKNOWN` Parameters
- [ADR-005](./adr-005.md): Types are Sets
- [ADR-006](./adr-006.md): Three-valued Truth
- [ADR-007](./adr-007.md): Three-valued Logic Operators
- [ADR-008](./adr-008.md): Encapsulation vs Data
- [ADR-009](./adr-009.md): Interface Types
- [ADR-010](./adr-010.md): Serializable `data`
- [ADR-011](./adr-011.md): Ad Hoc Data Structures
- [ADR-012](./adr-012.md): Parameters Labels and Ordering
- [ADR-013](./adr-013.md): Currying on Labels
- [ADR-014](./adr-014.md): Traits and Static
- [ADR-015](./adr-015.md): Basic ARC Rules
- [ADR-016](./adr-016.md): Backend-Managed Boxing of Unboxed Primitives
- [ADR-017](./adr-017.md): Inheritance Allocation
- [ADR-018](./adr-018.md): `object` Initialization
- [ADR-019](./adr-019.md): `namespace`
- [ADR-020](./adr-020.md): Singleton `service`
- [ADR-021](./adr-021.md): Binary Operators and Precedence
- [ADR-022](./adr-022.md): `integer` Exponentiation
- [ADR-023](./adr-023.md): `integer` Division
- [ADR-024](./adr-024.md): The `integer` Combinatorial Explosion
- [ADR-025](./adr-025.md): The `real` Datatype: Precision Kinds and Bases
- [ADR-026](./adr-026.md): The `real` Datatype: Compatibility and Precision
- [ADR-027](./adr-027.md): The `real` Datatype: Exact Values and Single Rounding at Storage
- [ADR-028](./adr-028.md): The `real` Datatype: Assignment, Equality, and Literals
- [ADR-029](./adr-029.md): The `real` Datatype: Inference
- [ADR-030](./adr-030.md): The `real` Datatype: `real big`
- [ADR-031](./adr-031.md): Backend Execution Mechanics and Lowering for Reals
- [ADR-032](./adr-032.md): `subset` and `type`
- [ADR-033](./adr-033.md): Private Properties Are Per Type
- [ADR-034](./adr-034.md): Declaring and Conforming to `trait`s and `role`s
- [ADR-035](./adr-035.md): Separating Mutability from Isolation in Declaration Syntax
