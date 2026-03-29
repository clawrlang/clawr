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

## Example Generated C Code

```c
typedef struct DataStructure {
    __rc_header header;
    u_int8_t x;
    u_int8_t y;
} DataStructure;
static const __type_info DataStructureˇtype = {
    .data_type = { .size = sizeof(DataStructure) }
};

DataStructure* original = allocRC(DataStructure, __rc_SHARED);
original->x = 47;
original->y = 42;
DataStructure* reference = retainRC(original);
mutateRC(original);
original->x = 2;
releaseRC(original);
releaseRC(reference);
```

## Corresponding IR (approximate)

```json
{
  "structs": [
    {
      "kind": "struct",
      "name": "DataStructure",
      "fields": [
        { "name": "header", "type": "__rc_header" },
        { "name": "x", "type": "uint8_t" },
        { "name": "y", "type": "uint8_t" }
      ]
    }
  ],
  "variables": [
    {
      "kind": "var-decl",
      "type": "__type_info",
      "name": "DataStructureˇtype",
      "value": {
        "kind": "struct-init",
        "fields": {
          "data_type": {
            "kind": "struct-init",
            "fields": {
              "size": {
                "kind": "raw-expression",
                "expression": "sizeof(DataStructure)"
              }
            }
          }
        }
      },
      "modifiers": ["static", "const"]
    }
  ],
  "functions": [
    {
      "kind": "function",
      "name": "main",
      "returnType": "int",
      "parameters": [],
      "body": [
        {
          "kind": "var-decl",
          "type": "DataStructure",
          "name": "original",
          "value": {
            "kind": "function-call",
            "name": "allocRC",
            "arguments": [
              { "kind": "var-ref", "name": "DataStructure" },
              { "kind": "var-ref", "name": "__rc_SHARED" }
            ]
          }
        },
        {
          "kind": "assign",
          "target": {
            "kind": "field-reference",
            "object": { "kind": "var-ref", "name": "original" },
            "field": "x",
            "deref": true
          },
          "value": { "kind": "raw-expression", "expression": "47" }
        },
        {
          "kind": "assign",
          "target": {
            "kind": "field-reference",
            "object": { "kind": "var-ref", "name": "original" },
            "field": "y",
            "deref": true
          },
          "value": { "kind": "raw-expression", "expression": "42" }
        },
        {
          "kind": "var-decl",
          "type": "DataStructure*",
          "name": "reference",
          "value": {
            "kind": "function-call",
            "name": "retainRC",
            "arguments": [{ "kind": "var-ref", "name": "original" }]
          }
        },
        {
          "kind": "function-call",
          "name": "mutateRC",
          "arguments": [{ "kind": "var-ref", "name": "original" }]
        },
        {
          "kind": "assign",
          "target": {
            "kind": "field-reference",
            "object": { "kind": "var-ref", "name": "original" },
            "field": "x",
            "deref": true
          },
          "value": { "kind": "raw-expression", "expression": "2" }
        },
        {
          "kind": "function-call",
          "name": "releaseRC",
          "arguments": [{ "kind": "var-ref", "name": "original" }]
        },
        {
          "kind": "function-call",
          "name": "releaseRC",
          "arguments": [{ "kind": "var-ref", "name": "reference" }]
        }
      ]
    }
  ]
}
```

---

This design will guide the next steps: extending the IR, updating codegen, and adding tests for this pattern.
