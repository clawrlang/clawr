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
                properties: [
                    // supertype properties
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
                    // subtype properties
                    {
                        // Note: subtype can repeat property names from super
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
            domain: {
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

The thing to note above is that the current CIR format does not allow explicitly identifying which type in the inheritance hierarchy each property belongs to. Unless we redesign the format, we will need to rely only on spatial order (supertype properties first subtype properties after).

I believe `memcpy` (or rather `struct` initializers in general) allows merely listing the properties in layout order. Matching property names is not strictly necessary, and duplicated property names cannot conflict if the properties are not named.

But even so: we should perhaps allow for varying backend implementations. So the CiR should be redesigned so that each property can refer to its declaring type.

Or maybe we don't need that. Maybe it can be the CIR specification: allocation is always complete. If so, the `self` allocations should be removed from the initializers (only the super initializer call would remains).

Well, we’ll still need to distinguish owner type for each property. The properties are named because the backend doesn’t _have_ to use `memcpy`. (And it doesn’t need to layout property in the order they are declared.) It should be allowed to set each property individually by name. But if it cannot separate the properties by type, the names will conflict.

Besides: the layout within each type cannot be known by the frontend. The ordering cannot be guaranteed to be compatible. It can only be guaranteed to be _consistent_ with other parts of the CIR.
