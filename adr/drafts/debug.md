<!-- markdownlint-disable MD041 MD033 -->
<img src="./images/rawry.png" alt="Rawry" style="float: right; margin: 10px;">

# Debug Information in the CIR

## Status

✍🏼 **Draft**

> A rough sketch of an idea

## Context

The frontend performs aggressive optimization ([ADR-005](./adr-005.md), [ADR-015](./adr-015.md)).
Source correspondence can be lost. The CIR is the interchange format
([ADR-001](./adr-001.md)) and must carry enough information for a debugger to map
runtime state back to source.

## Decision

CIR instructions MAY carry optional debug metadata:

- source span (file, line, column range)
- provenance chain (what expression/instruction this was derived from)
- static lattice of the value at this point

The metadata is optional. Backends MUST NOT depend on it. Backends MUST
NOT emit it. It is consumed by debuggers and reference interpreters only.

Optimization level is a frontend concern. The CIR format does not
distinguish "debug" from "release" code. A frontend MAY emit more or
less optimized CIR depending on flags, but the format is the same.

The frontend MUST NOT erase provenance when folding. It MAY omit
provenance entirely (no debug info), but if it emits any, the chain
must be consistent.

Implicit backend boxing ([ADR-016](./adr-016.md)) is backend-private and MUST NOT
appear in debug metadata as a source-level operation.

## Rationale

- Debug info must be decided before CIR is frozen.
- Provenance preserves the user's mental model under optimization.
- Keeping debug info out of backend obligations keeps [ADR-001](./adr-001.md) intact.
- A CIR interpreter with provenance is a platform-independent debugger.

## Alternatives Considered

- Separate debug CIR format.
- Backend-emitted debug info (DWARF-only).
- No debug info; source-level debugging unsupported.

## Consequences

### Positive

- Debugging can be designed later without changing the CIR.
- Reference interpreter can serve as a debugger.
- Static lattices are exposed to the user, not just the optimizer.

### Negative

- Frontend must record provenance even when it folds.
- CIR is slightly larger when debug info is present.
- Some optimizations are fundamentally undebuggable; users must accept this.

## Related ADRs

- [ADR-001](./adr-001.md) (Syntax, Semantics and CIR)
- [ADR-005](./adr-005.md) (Type Lattices)
- [ADR-015](./adr-015.md) (Basic ARC Rules)
- [ADR-016](./adr-016.md) (Backend-Managed Boxing)
