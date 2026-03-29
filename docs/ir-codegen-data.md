# IR & Codegen Design: Data Structure Initialization

## Goal

Enable the Clawr compiler to generate C code for initializing a heap-allocated, reference-counted data structure using explicit field assignments, as in the runtime test cases.

## IR Design

- **IR Type Definition:**
  - Represent data types (structs) in IR, including field names and types.
- **IR Data Allocation:**
  - Represent allocation of a new data instance (e.g., `allocRC(Type, mode)`), with mode (`__rc_SHARED`, `__rc_ISOLATED`).
- **IR Field Assignment:**
  - Represent assignment to fields (e.g., `obj->x = value`).
- **IR Reference Management:**
  - Represent retain/release operations for reference counting.

## Codegen Design

- **Emit C struct definition** for each data type.
- **Emit allocation code** using `allocRC` with the correct mode.
- **Emit field assignments** as explicit statements after allocation.
- **Emit retain/release calls** as needed for reference management.

## Example IR (Pseudocode)

```c
// Allocate and initialize a DataStructure
let obj = allocRC(DataStructure, __rc_SHARED)
obj.x = 47
obj.y = 42
let ref = retainRC(obj)
mutateRC(obj)
obj.x = 2
releaseRC(obj)
releaseRC(ref)
```

## Example Generated C Code

```c
DataStructure* original = allocRC(DataStructure, __rc_SHARED);
original->x = 47;
original->y = 42;
DataStructure* reference = retainRC(original);
mutateRC(original);
original->x = 2;
releaseRC(original);
releaseRC(reference);
```

---

This design will guide the next steps: extending the IR, updating codegen, and adding tests for this pattern.
