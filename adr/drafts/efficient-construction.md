# Efficient Construction

Is it possible to merge all initializers in the inheritance stack into a single `memcpy`?

Maybe the frontend can emit something like…

```ts
const sample: ClawrModule = {
    $schema: 'http://clawr.lang/schema/cir/DRAFT-0',
    startBlock: [
        {
            // Allocate a memory structure (identical to `data`)
            kind: 'VARIABLE_DECL',
            name: 'obj',
            initialValue: {
                kind: 'ALLOCATION',
                isolationLevel: 'ISOLATED',
                value: {
                    type: 'rc-type',
                    name: 'Object',
                },
                fields: [
                    // supertype fields
                    {
                        name: 'a',
                        value: {
                            kind: 'INTEGER_LITERAL',
                            value: {
                                type: 'integer',
                                max: '42',
                                min: '42',
                            },
                        },
                    },
                    {
                        name: 'b',
                        value: {
                            kind: 'INTEGER_LITERAL',
                            value: {
                                type: 'integer',
                                max: '42',
                                min: '42',
                            },
                        },
                    },
                    // subtype fields
                    {
                        // Note: subtype can repeat field names from super
                        name: 'a',
                        value: {
                            kind: 'INTEGER_LITERAL',
                            value: {
                                type: 'integer',
                                max: '42',
                                min: '42',
                            },
                        },
                    },
                ],
                ],
            },
            lattice: {
                type: 'rc-type',
                name: 'Object',
            },
        },
        {
            // Call the bottom type initializer
            // It will call its super initializer
            kind: 'CALL',
            name: {
                baseName: 'new',
                labels: []
            },
            arguments: [],
            receiver: {
                dispatch: 'direct',
                object: {
                    kind: 'VARIABLE_REF',
                    name: 'obj',
                    value: {
                        type: 'rc-type',
                        name: 'Object',
                    },
                },
            },
        },
    ],
}
```

The thing to note above is that the current CIR format does not allow explicitly identifying which type in the inheritance hierarchy each field belongs to. Unless we redesign the format, we will need to rely only on spatial order (supertype fields first subtype fields after).

I believe `memcpy` (or rather `struct` initializers in general) allows merely listing the fields in layout order. Matching field names is not strictly necessary, and duplicated field names cannot conflict if the fields are not named.

But even so: we should perhaps allow for varying backend implementations. So the CiR should be redesigned so that each field can refer to its declaring type.

Or maybe we don't need that. Maybe it can be the CIR specification: allocation is always complete. If so, the `self` allocations should be removed from the initializers (only the super initializer call would remains).

Well, we’ll still need to distinguish owner type for each field. The fields are named because the backend doesn’t *have* to use `memcpy`. (And it doesn’t need to layout field in the order they are declared.) It should be allowed to set each field individually by name. But if it cannot separate the fields by type, the names will conflict.

Besides: the layout within each type cannot be known by the frontend. The ordering cannot be guaranteed to be compatible. It can only be guaranteed to be *consistent* with other parts of the CIR.
