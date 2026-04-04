import { describe, expect, it } from 'bun:test'
import {
    SemanticDataDeclaration,
    SemanticExpression,
    SemanticModule,
    SemanticOwnershipEffects,
    SemanticStatement,
} from '../../src/semantic-analyzer'
import { IRGenerator } from '../../src/ir/ir-generator'
import { CStatement } from '../../src/ir'

const somePosition = { line: 1, column: 1 }

type SemanticProgramFixture = { body: any[] }

function collectMutates(expr: any): SemanticExpression[] {
    const mutates: SemanticExpression[] = []
    let current = expr
    while (current?.kind === 'field-access') {
        mutates.unshift(current.object)
        current = current.object
    }
    if (mutates.length === 0 && expr?.kind === 'field-access') {
        mutates.push(expr.object)
    }
    return mutates
}

function normalizeOwnership(
    body: any[],
    typeNames: Set<string>,
): SemanticStatement[] {
    const variableTypes = new Map<string, string>()

    return body.map((stmt) => {
        if (stmt.kind === 'var-decl') {
            variableTypes.set(stmt.name, stmt.valueSet.type)
            const ownership: SemanticOwnershipEffects =
                stmt.ownership ??
                (typeNames.has(stmt.valueSet.type)
                    ? {
                          releaseAtScopeExit: true,
                          retains:
                              stmt.value.kind === 'data-literal'
                                  ? []
                                  : [
                                        {
                                            kind: 'identifier',
                                            name: stmt.name,
                                            position:
                                                stmt.position ?? somePosition,
                                        },
                                    ],
                      }
                    : {})

            return { ...stmt, ownership } as SemanticStatement
        }

        if (stmt.kind === 'assign') {
            const ownership: SemanticOwnershipEffects =
                stmt.ownership ??
                (stmt.target.kind === 'field-access'
                    ? { mutates: collectMutates(stmt.target) }
                    : stmt.target.kind === 'identifier' &&
                        typeNames.has(variableTypes.get(stmt.target.name) ?? '')
                      ? {
                            retains: [stmt.value],
                            releases: [stmt.target],
                        }
                      : {})

            return { ...stmt, ownership } as SemanticStatement
        }

        return stmt as SemanticStatement
    })
}

function toModule(program: SemanticProgramFixture): SemanticModule {
    const types = program.body
        .filter(
            (stmt): stmt is SemanticDataDeclaration =>
                stmt.kind === 'data-decl',
        )
        .map((stmt) => ({
            ...stmt,
            fields: stmt.fields.map((field) => ({
                ...field,
                isReferenceCounted:
                    field.isReferenceCounted ?? field.type !== 'truthvalue',
            })),
        }))
    const typeNames = new Set(types.map((t) => t.name))

    return {
        imports: [],
        functions: [
            {
                kind: 'function',
                name: 'main',
                parameters: [],
                body: normalizeOwnership(
                    program.body.filter((stmt) => stmt.kind !== 'data-decl'),
                    typeNames,
                ),
            },
        ],
        types,
        objects: [],
        services: [],
        globals: [],
        typeKinds: new Map(),
        functionSignatures: new Map(),
    }
}

describe('Lowering Tests', () => {
    it('lowers truthvalue variable declaration as truthvalue_t', () => {
        const program: SemanticProgramFixture = {
            body: [
                {
                    kind: 'var-decl',
                    semantics: 'const',
                    name: 'x',
                    valueSet: { type: 'truthvalue' },
                    value: {
                        kind: 'truthvalue',
                        value: 'ambiguous',
                        position: somePosition,
                    },
                },
            ],
        }
        const module = new IRGenerator().generate(toModule(program))
        expect(module.functions[0].body[0]).toMatchObject({
            kind: 'var-decl',
            type: 'truthvalue_t',
            name: 'x',
            value: { kind: 'var-ref', name: 'c_ambiguous' },
        } satisfies CStatement)
    })

    it('lowers integer variable declaration as Integer*', () => {
        const program: SemanticProgramFixture = {
            body: [
                {
                    kind: 'var-decl',
                    semantics: 'const',
                    name: 'x',
                    valueSet: { type: 'integer' },
                    value: {
                        kind: 'integer',
                        value: 42n,
                        position: somePosition,
                    },
                },
            ],
        }
        const module = new IRGenerator().generate(toModule(program))
        expect(module.functions[0].body[0]).toMatchObject({
            kind: 'var-decl',
            type: 'Integer*',
            name: 'x',
            value: {
                kind: 'function-call',
                name: 'Integer¸fromCString',
                arguments: [{ kind: 'string', value: '42' }],
            },
        } satisfies CStatement)
    })

    it('lowers string concatenation to String¸concat call', () => {
        const program: SemanticProgramFixture = {
            body: [
                {
                    kind: 'var-decl',
                    semantics: 'const',
                    name: 's',
                    valueSet: { type: 'string' },
                    value: {
                        kind: 'binary',
                        operator: '+',
                        left: {
                            kind: 'string',
                            value: 'hello',
                            position: somePosition,
                        },
                        right: {
                            kind: 'string',
                            value: ' world',
                            position: somePosition,
                        },
                        position: somePosition,
                    },
                },
            ],
        }

        const module = new IRGenerator().generate(toModule(program))
        expect(module.functions[0].body[0]).toMatchObject({
            kind: 'var-decl',
            type: 'String*',
            name: 's',
            value: {
                kind: 'function-call',
                name: 'String¸concat',
                arguments: [
                    {
                        kind: 'function-call',
                        name: 'String¸fromCString',
                        arguments: [{ kind: 'string', value: 'hello' }],
                    },
                    {
                        kind: 'function-call',
                        name: 'String¸fromCString',
                        arguments: [{ kind: 'string', value: ' world' }],
                    },
                ],
            },
        } satisfies CStatement)
    })

    it('lowers array literal declaration to Array¸new and element assignments', () => {
        const program: SemanticProgramFixture = {
            body: [
                {
                    kind: 'var-decl',
                    semantics: 'const',
                    name: 'xs',
                    valueSet: { type: '[integer]' },
                    value: {
                        kind: 'array-literal',
                        elements: [
                            {
                                kind: 'integer',
                                value: 1n,
                                position: somePosition,
                            },
                            {
                                kind: 'integer',
                                value: 2n,
                                position: somePosition,
                            },
                        ],
                        position: somePosition,
                    },
                    ownership: {
                        releaseAtScopeExit: true,
                        retains: [],
                    },
                },
            ],
        }

        const module = new IRGenerator().generate(toModule(program))
        expect(module.functions[0].body[0]).toMatchObject({
            kind: 'var-decl',
            type: 'Array*',
            name: 'xs',
            value: {
                kind: 'function-call',
                name: 'Array¸new',
            },
        })

        expect(module.functions[0].body[1]).toMatchObject({
            kind: 'assign',
            target: {
                kind: 'raw-expression',
                expression: 'ARRAY_ELEMENT_AT(0, xs, Integer*)',
            },
            value: {
                kind: 'function-call',
                name: 'Integer¸fromCString',
                arguments: [{ kind: 'string', value: '1' }],
            },
        } satisfies CStatement)

        expect(module.functions[0].body[2]).toMatchObject({
            kind: 'assign',
            target: {
                kind: 'raw-expression',
                expression: 'ARRAY_ELEMENT_AT(1, xs, Integer*)',
            },
            value: {
                kind: 'function-call',
                name: 'Integer¸fromCString',
                arguments: [{ kind: 'string', value: '2' }],
            },
        } satisfies CStatement)
    })

    it('lowers array index reads to checked array access', () => {
        const program: SemanticProgramFixture = {
            body: [
                {
                    kind: 'var-decl',
                    semantics: 'const',
                    name: 'x',
                    valueSet: { type: 'integer' },
                    value: {
                        kind: 'array-index',
                        array: {
                            kind: 'identifier',
                            name: 'xs',
                            position: somePosition,
                        },
                        index: {
                            kind: 'integer',
                            value: 1n,
                            position: somePosition,
                        },
                        elementType: 'integer',
                        position: somePosition,
                    },
                },
            ],
        }

        const module = new IRGenerator().generate(toModule(program))
        expect(module.functions[0].body[0]).toMatchObject({
            kind: 'var-decl',
            type: 'Integer*',
            name: 'x',
            value: {
                kind: 'raw-expression',
                expression: 'ARRAY_ELEMENT_AT_CHECKED(1, xs, Integer*)',
            },
        })
    })

    it('lowers call-expression variable initialization to C function call', () => {
        const program: SemanticProgramFixture = {
            body: [
                {
                    kind: 'var-decl',
                    semantics: 'const',
                    name: 'x',
                    valueSet: { type: 'truthvalue' },
                    value: {
                        kind: 'call',
                        callee: {
                            kind: 'identifier',
                            name: 'yes',
                            position: somePosition,
                        },
                        arguments: [],
                        position: somePosition,
                    },
                },
            ],
        }

        const module = new IRGenerator().generate(toModule(program))
        expect(module.functions[0].body[0]).toMatchObject({
            kind: 'var-decl',
            type: 'truthvalue_t',
            name: 'x',
            value: {
                kind: 'function-call',
                name: 'yes',
                arguments: [],
            },
        } satisfies CStatement)
    })

    it('mangles labeled call names with label suffixes', () => {
        const program: SemanticProgramFixture = {
            body: [
                {
                    kind: 'var-decl',
                    semantics: 'const',
                    name: 'x',
                    valueSet: { type: 'integer' },
                    value: {
                        kind: 'call',
                        callee: {
                            kind: 'identifier',
                            name: 'adjust',
                            position: somePosition,
                        },
                        arguments: [
                            {
                                value: {
                                    kind: 'integer',
                                    value: 1n,
                                    position: somePosition,
                                },
                            },
                            {
                                label: 'down',
                                value: {
                                    kind: 'integer',
                                    value: 2n,
                                    position: somePosition,
                                },
                            },
                        ],
                        position: somePosition,
                    },
                },
            ],
        }

        const module = new IRGenerator().generate(toModule(program))
        expect(module.functions[0].body[0]).toMatchObject({
            kind: 'var-decl',
            type: 'Integer*',
            name: 'x',
            value: {
                kind: 'function-call',
                name: 'adjust__down',
                arguments: [
                    {
                        kind: 'function-call',
                        name: 'Integer¸fromCString',
                        arguments: [{ kind: 'string', value: '1' }],
                    },
                    {
                        kind: 'function-call',
                        name: 'Integer¸fromCString',
                        arguments: [{ kind: 'string', value: '2' }],
                    },
                ],
            },
        } satisfies CStatement)
    })

    it('mangles qualified method call names and preserves receiver as first arg', () => {
        const program: SemanticProgramFixture = {
            body: [
                {
                    kind: 'var-decl',
                    semantics: 'const',
                    name: 'x',
                    valueSet: { type: 'integer' },
                    value: {
                        kind: 'call',
                        callee: {
                            kind: 'identifier',
                            name: 'Counter·adjust',
                            position: somePosition,
                        },
                        dispatch: {
                            kind: 'virtual',
                            methodName: 'adjust',
                            ownerType: 'Counter',
                            receiverType: 'Counter',
                        },
                        arguments: [
                            {
                                value: {
                                    kind: 'identifier',
                                    name: 'counter',
                                    position: somePosition,
                                },
                            },
                            {
                                label: 'down',
                                value: {
                                    kind: 'integer',
                                    value: 2n,
                                    position: somePosition,
                                },
                            },
                        ],
                        position: somePosition,
                    },
                },
            ],
        }

        const module = new IRGenerator().generate(toModule(program))
        expect(module.functions[0].body[0]).toMatchObject({
            kind: 'var-decl',
            type: 'Integer*',
            name: 'x',
            value: {
                kind: 'function-call',
                name: 'Counter·adjust__down',
                dispatch: {
                    kind: 'virtual',
                    methodName: 'adjust',
                    ownerType: 'Counter',
                    receiverType: 'Counter',
                },
                arguments: [
                    { kind: 'var-ref', name: 'counter' },
                    {
                        kind: 'function-call',
                        name: 'Integer¸fromCString',
                        arguments: [{ kind: 'string', value: '2' }],
                    },
                ],
            },
        } satisfies CStatement)
    })

    it('preserves direct dispatch metadata for service calls', () => {
        const program: SemanticProgramFixture = {
            body: [
                {
                    kind: 'var-decl',
                    semantics: 'const',
                    name: 'x',
                    valueSet: { type: 'truthvalue' },
                    value: {
                        kind: 'call',
                        callee: {
                            kind: 'identifier',
                            name: 'Clock·now',
                            position: somePosition,
                        },
                        dispatch: {
                            kind: 'direct',
                            methodName: 'now',
                            ownerType: 'Clock',
                            receiverType: 'Clock',
                        },
                        arguments: [
                            {
                                value: {
                                    kind: 'identifier',
                                    name: 'clock',
                                    position: somePosition,
                                },
                            },
                        ],
                        position: somePosition,
                    },
                },
            ],
        }

        const module = new IRGenerator().generate(toModule(program))
        expect(module.functions[0].body[0]).toMatchObject({
            kind: 'var-decl',
            type: 'truthvalue_t',
            name: 'x',
            value: {
                kind: 'function-call',
                name: 'Clock·now',
                arguments: [{ kind: 'var-ref', name: 'clock' }],
                dispatch: {
                    kind: 'direct',
                    methodName: 'now',
                    ownerType: 'Clock',
                    receiverType: 'Clock',
                },
            },
        } satisfies CStatement)
    })

    it('lowers print of truthvalue literal correctly', () => {
        const program: SemanticProgramFixture = {
            body: [
                {
                    kind: 'print',
                    dispatchType: 'truthvalue',
                    value: {
                        kind: 'truthvalue',
                        value: 'true',
                        position: somePosition,
                    },
                    position: somePosition,
                },
            ],
        }
        const module = new IRGenerator().generate(toModule(program))
        expect(module.functions[0].body[0]).toMatchObject({
            kind: 'function-call',
            name: 'printf',
            arguments: [
                { kind: 'string', value: '%s\\n' },
                {
                    kind: 'function-call',
                    name: 'truthvalue·toCString',
                    arguments: [{ kind: 'var-ref', name: 'c_true' }],
                },
            ],
        } satisfies CStatement)
    })

    it('lowers print of integer literal correctly', () => {
        const program: SemanticProgramFixture = {
            body: [
                {
                    kind: 'print',
                    dispatchType: 'integer',
                    value: {
                        kind: 'integer',
                        value: 42n,
                        position: somePosition,
                    },
                    position: somePosition,
                },
            ],
        }
        const module = new IRGenerator().generate(toModule(program))
        // printf("%s\n", "42");
        expect(module.functions[0].body[0]).toMatchObject({
            kind: 'function-call',
            name: 'printf',
            arguments: [
                { kind: 'string', value: '%s\\n' },
                { kind: 'string', value: '42' },
            ],
        } satisfies CStatement)
    })

    it('lowers print of integer variable with a single String temp', () => {
        const program: SemanticProgramFixture = {
            body: [
                {
                    kind: 'var-decl',
                    semantics: 'const',
                    valueSet: { type: 'integer' },
                    name: 'x',
                    value: {
                        kind: 'integer',
                        value: 42n,
                        position: somePosition,
                    },
                },
                {
                    kind: 'print',
                    dispatchType: 'integer',
                    value: {
                        kind: 'identifier',
                        name: 'x',
                        position: somePosition,
                    },
                    position: somePosition,
                },
            ],
        }

        const module = new IRGenerator().generate(toModule(program))
        expect(module.functions[0].body[1]).toMatchObject({
            kind: 'var-decl',
            name: 'tempˇ0',
            type: 'String*',
            value: {
                kind: 'function-call',
                name: 'Integer·toStringRC',
                arguments: [{ kind: 'var-ref', name: 'x' }],
            },
        } satisfies CStatement)
        // printf("%s\n", String·toCString(tempˇ0));
        expect(module.functions[0].body[2]).toMatchObject({
            kind: 'function-call',
            name: 'printf',
            arguments: [
                { kind: 'string', value: '%s\\n' },
                {
                    kind: 'function-call',
                    name: 'String·toCString',
                    arguments: [{ kind: 'var-ref', name: 'tempˇ0' }],
                },
            ],
        } satisfies CStatement)
        // releaseRC(tempˇ0);
        expect(module.functions[0].body[3]).toMatchObject({
            kind: 'function-call',
            name: 'releaseRC',
            arguments: [{ kind: 'var-ref', name: 'tempˇ0' }],
        } satisfies CStatement)
    })

    it('lowers print of truthvalue variable correctly', () => {
        const program: SemanticProgramFixture = {
            body: [
                {
                    kind: 'var-decl',
                    semantics: 'const',
                    valueSet: { type: 'truthvalue' },
                    name: 'x',
                    value: {
                        kind: 'truthvalue',
                        value: 'ambiguous',
                        position: somePosition,
                    },
                },
                {
                    kind: 'print',
                    dispatchType: 'truthvalue',
                    value: {
                        kind: 'identifier',
                        name: 'x',
                        position: somePosition,
                    },
                    position: somePosition,
                },
            ],
        }
        const module = new IRGenerator().generate(toModule(program))
        expect(module.functions[0].body[1]).toMatchObject({
            kind: 'function-call',
            name: 'printf',
            arguments: [
                { kind: 'string', value: '%s\\n' },
                {
                    kind: 'function-call',
                    name: 'truthvalue·toCString',
                    arguments: [{ kind: 'var-ref', name: 'x' }],
                },
            ],
        } satisfies CStatement)
    })

    it('lowers data declaration', () => {
        const program: SemanticProgramFixture = {
            body: [
                {
                    kind: 'data-decl',
                    name: 'Point',
                    fields: [
                        { name: 'x', type: 'truthvalue' },
                        { name: 'y', type: 'truthvalue' },
                    ],
                    position: somePosition,
                },
            ],
        }

        const module = new IRGenerator().generate(toModule(program))
        expect(
            module.functions.find(
                (fn) => fn.name === 'PointˇretainNestedFields',
            ),
        ).toMatchObject({
            kind: 'function',
            name: 'PointˇretainNestedFields',
            returnType: 'void',
            parameters: [{ name: 'self', type: 'void*' }],
            body: [],
        })
        expect(
            module.functions.find(
                (fn) => fn.name === 'PointˇreleaseNestedFields',
            ),
        ).toMatchObject({
            kind: 'function',
            name: 'PointˇreleaseNestedFields',
            returnType: 'void',
            parameters: [{ name: 'self', type: 'void*' }],
            body: [],
        })
        /*
        typedef struct DataStructure {
            __rc_header header;
            u_int8_t x;
            u_int8_t y;
        } DataStructure;
        */
        expect(module.structs[0]).toMatchObject({
            kind: 'struct',
            name: 'Point',
            fields: [
                { name: 'header', type: '__rc_header' },
                { name: 'x', type: 'truthvalue_t' },
                { name: 'y', type: 'truthvalue_t' },
            ],
        })
        /*
        typedef struct DataStructureˇfields {
            u_int8_t x;
            u_int8_t y;
        } DataStructureˇfields;
        */
        expect(module.structs[1]).toMatchObject({
            kind: 'struct',
            name: 'Pointˇfields',
            fields: [
                { name: 'x', type: 'truthvalue_t' },
                { name: 'y', type: 'truthvalue_t' },
            ],
        })
        /*
        static const __type_info DataStructureˇtype = {
            .data_type = { .size = sizeof(DataStructure) }
        };
        */
        expect(module.variables[0]).toMatchObject({
            kind: 'var-decl',
            name: 'Pointˇtype',
            type: '__type_info',
            value: {
                kind: 'struct-init',
                fields: {
                    data_type: {
                        kind: 'struct-init',
                        fields: {
                            size: {
                                kind: 'raw-expression',
                                expression: 'sizeof(Point)',
                            },
                            retain_nested_fields: {
                                kind: 'raw-expression',
                                expression: 'PointˇretainNestedFields',
                            },
                            release_nested_fields: {
                                kind: 'raw-expression',
                                expression: 'PointˇreleaseNestedFields',
                            },
                        },
                    },
                },
            },
        })
    })

    it('lowers non-primitive data fields to pointers of their declared type', () => {
        const program: SemanticProgramFixture = {
            body: [
                {
                    kind: 'data-decl',
                    name: 'Inner',
                    fields: [{ name: 'x', type: 'truthvalue' }],
                    position: somePosition,
                },
                {
                    kind: 'data-decl',
                    name: 'Outer',
                    fields: [{ name: 'inner', type: 'Inner' }],
                    position: somePosition,
                },
            ],
        }

        const module = new IRGenerator().generate(toModule(program))
        expect(module.structs[2]).toMatchObject({
            kind: 'struct',
            name: 'Outer',
            fields: [
                { name: 'header', type: '__rc_header' },
                { name: 'inner', type: 'Inner*' },
            ],
        })
        expect(module.structs[3]).toMatchObject({
            kind: 'struct',
            name: 'Outerˇfields',
            fields: [{ name: 'inner', type: 'Inner*' }],
        })

        expect(
            module.functions.find(
                (fn) => fn.name === 'InnerˇretainNestedFields',
            ),
        ).toMatchObject({
            kind: 'function',
            name: 'InnerˇretainNestedFields',
            body: [],
        })
        expect(
            module.functions.find(
                (fn) => fn.name === 'InnerˇreleaseNestedFields',
            ),
        ).toMatchObject({
            kind: 'function',
            name: 'InnerˇreleaseNestedFields',
            body: [],
        })
        expect(
            module.functions.find(
                (fn) => fn.name === 'OuterˇretainNestedFields',
            ),
        ).toMatchObject({
            kind: 'function',
            name: 'OuterˇretainNestedFields',
            body: [
                {
                    kind: 'function-call',
                    name: 'retainRC',
                    arguments: [
                        {
                            kind: 'field-reference',
                            object: {
                                kind: 'raw-expression',
                                expression: '((Outer*)self)',
                            },
                            field: 'inner',
                            deref: true,
                        },
                    ],
                },
            ],
        })
        expect(
            module.functions.find(
                (fn) => fn.name === 'OuterˇreleaseNestedFields',
            ),
        ).toMatchObject({
            kind: 'function',
            name: 'OuterˇreleaseNestedFields',
            body: [
                {
                    kind: 'function-call',
                    name: 'releaseRC',
                    arguments: [
                        {
                            kind: 'field-reference',
                            object: {
                                kind: 'raw-expression',
                                expression: '((Outer*)self)',
                            },
                            field: 'inner',
                            deref: true,
                        },
                    ],
                },
            ],
        })
    })

    it('lowers if conditions as strict true checks', () => {
        const program: SemanticProgramFixture = {
            body: [
                {
                    kind: 'var-decl',
                    semantics: 'mut',
                    name: 'x',
                    valueSet: { type: 'truthvalue' },
                    value: {
                        kind: 'truthvalue',
                        value: 'ambiguous',
                        position: somePosition,
                    },
                },
                {
                    kind: 'if',
                    condition: {
                        kind: 'identifier',
                        name: 'x',
                        position: somePosition,
                    },
                    thenBranch: [
                        {
                            kind: 'print',
                            dispatchType: 'truthvalue',
                            value: {
                                kind: 'truthvalue',
                                value: 'true',
                                position: somePosition,
                            },
                            position: somePosition,
                        },
                    ],
                    elseBranch: [
                        {
                            kind: 'print',
                            dispatchType: 'truthvalue',
                            value: {
                                kind: 'truthvalue',
                                value: 'false',
                                position: somePosition,
                            },
                            position: somePosition,
                        },
                    ],
                    position: somePosition,
                },
            ],
        }

        const module = new IRGenerator().generate(toModule(program))
        expect(module.functions[0].body[1]).toMatchObject({
            kind: 'if',
            condition: {
                kind: 'raw-expression',
                expression: '(x == c_true)',
            },
            thenBranch: [{ kind: 'function-call', name: 'printf' }],
            elseBranch: [{ kind: 'function-call', name: 'printf' }],
        })
    })

    it('lowers field access as if condition with strict-true comparison', () => {
        const program: SemanticProgramFixture = {
            body: [
                {
                    kind: 'data-decl',
                    name: 'Point',
                    fields: [{ name: 'x', type: 'truthvalue' }],
                    position: somePosition,
                },
                {
                    kind: 'if',
                    condition: {
                        kind: 'field-access',
                        object: {
                            kind: 'identifier',
                            name: 'p',
                            position: somePosition,
                        },
                        field: 'x',
                        position: somePosition,
                    },
                    thenBranch: [
                        {
                            kind: 'print',
                            dispatchType: 'truthvalue',
                            value: {
                                kind: 'truthvalue',
                                value: 'true',
                                position: somePosition,
                            },
                            position: somePosition,
                        },
                    ],
                    elseBranch: undefined,
                    position: somePosition,
                },
            ],
        }

        const module = new IRGenerator().generate(toModule(program))
        expect(module.functions[0].body[0]).toMatchObject({
            kind: 'if',
            condition: {
                kind: 'raw-expression',
                expression: '(p->x == c_true)',
            },
        })
    })

    it('lowers while conditions as strict true checks', () => {
        const program: SemanticProgramFixture = {
            body: [
                {
                    kind: 'var-decl',
                    semantics: 'mut',
                    name: 'x',
                    valueSet: { type: 'truthvalue' },
                    value: {
                        kind: 'truthvalue',
                        value: 'ambiguous',
                        position: somePosition,
                    },
                },
                {
                    kind: 'while',
                    condition: {
                        kind: 'identifier',
                        name: 'x',
                        position: somePosition,
                    },
                    body: [{ kind: 'break', position: somePosition }],
                    position: somePosition,
                },
            ],
        }

        const module = new IRGenerator().generate(toModule(program))
        expect(module.functions[0].body[1]).toMatchObject({
            kind: 'while',
            condition: {
                kind: 'raw-expression',
                expression: '(x == c_true)',
            },
            body: [{ kind: 'break' }],
        })
    })

    it('lowers for-in loops to index-based while loops', () => {
        const program: SemanticProgramFixture = {
            body: [
                {
                    kind: 'for-in',
                    loopVar: 'x',
                    iterable: {
                        kind: 'identifier',
                        name: 'xs',
                        position: somePosition,
                    },
                    elementType: 'integer',
                    body: [
                        {
                            kind: 'print',
                            dispatchType: 'integer',
                            value: {
                                kind: 'identifier',
                                name: 'x',
                                position: somePosition,
                            },
                            position: somePosition,
                        },
                    ],
                    position: somePosition,
                },
            ],
        }

        const module = new IRGenerator().generate(toModule(program))
        expect(module.functions[0].body[0]).toMatchObject({
            kind: 'var-decl',
            type: 'Array*',
            value: { kind: 'raw-expression', expression: 'xs' },
        })
        expect(module.functions[0].body[1]).toMatchObject({
            kind: 'var-decl',
            type: 'size_t',
            value: { kind: 'raw-expression', expression: '0' },
        })
        expect(module.functions[0].body[2]).toMatchObject({
            kind: 'while',
            condition: {
                kind: 'raw-expression',
                expression: '(tempˇ1 < tempˇ0->count)',
            },
            body: [
                {
                    kind: 'var-decl',
                    type: 'Integer*',
                    name: 'x',
                    value: {
                        kind: 'raw-expression',
                        expression:
                            'ARRAY_ELEMENT_AT_CHECKED(tempˇ1, tempˇ0, Integer*)',
                    },
                },
                {
                    kind: 'var-decl',
                    type: 'String*',
                    name: 'tempˇ2',
                    value: {
                        kind: 'function-call',
                        name: 'Integer·toStringRC',
                    },
                },
                {
                    kind: 'function-call',
                    name: 'printf',
                },
                {
                    kind: 'function-call',
                    name: 'releaseRC',
                },
                {
                    kind: 'assign',
                    target: { kind: 'var-ref', name: 'tempˇ1' },
                    value: {
                        kind: 'raw-expression',
                        expression: 'tempˇ1 + 1',
                    },
                },
            ],
        })
    })

    it('lowers data literal', () => {
        const program: SemanticProgramFixture = {
            body: [
                {
                    kind: 'data-decl',
                    name: 'Point',
                    fields: [
                        { name: 'x', type: 'truthvalue' },
                        { name: 'y', type: 'truthvalue' },
                    ],
                    position: somePosition,
                },
                {
                    kind: 'var-decl',
                    semantics: 'const',
                    name: 'p',
                    valueSet: { type: 'Point' },
                    value: {
                        kind: 'data-literal',
                        fields: {
                            x: {
                                kind: 'truthvalue',
                                value: 'true',
                                position: somePosition,
                            },
                            y: {
                                kind: 'truthvalue',
                                value: 'false',
                                position: somePosition,
                            },
                        },
                        position: somePosition,
                    },
                },
            ],
        }
        const module = new IRGenerator().generate(toModule(program))
        // Point* p = allocRC(Point, __rc_ISOLATED);
        expect(module.functions[0].body[0]).toMatchObject({
            kind: 'var-decl',
            type: 'Point*',
            name: 'p',
            value: {
                kind: 'function-call',
                name: 'allocRC',
                arguments: [
                    {
                        kind: 'var-ref',
                        name: 'Point',
                    },
                    {
                        kind: 'var-ref',
                        name: '__rc_ISOLATED',
                    },
                ],
            },
        } satisfies CStatement)
        // memcpy(p, &(Pointˇfields){ .x = c_true, .y = c_false }, sizeof(Point));
        expect(module.functions[0].body[1]).toMatchObject({
            kind: 'function-call',
            name: 'memcpy',
            arguments: [
                { kind: 'raw-expression', expression: `(__rc_header*)p + 1` },
                {
                    kind: 'raw-expression',
                    expression: '&(Pointˇfields){ .x = c_true, .y = c_false }',
                },
                {
                    kind: 'raw-expression',
                    expression: 'sizeof(Point) - sizeof(__rc_header)',
                },
            ],
        } satisfies CStatement)
    })

    it('lowers data literal with integer field', () => {
        const program: SemanticProgramFixture = {
            body: [
                {
                    kind: 'data-decl',
                    name: 'Container',
                    fields: [
                        { name: 'value', type: 'integer' },
                        { name: 'flag', type: 'truthvalue' },
                    ],
                    position: somePosition,
                },
                {
                    kind: 'var-decl',
                    semantics: 'const',
                    name: 'c',
                    valueSet: { type: 'Container' },
                    value: {
                        kind: 'data-literal',
                        fields: {
                            value: {
                                kind: 'integer',
                                value: 42n,
                                position: somePosition,
                            },
                            flag: {
                                kind: 'truthvalue',
                                value: 'true',
                                position: somePosition,
                            },
                        },
                        position: somePosition,
                    },
                },
            ],
        }
        const module = new IRGenerator().generate(toModule(program))
        // memcpy(c, &(Containerˇfields){ .value = Integer¸fromCString("42"), .flag = c_true }, sizeof(Container));
        expect(module.functions[0].body[1]).toMatchObject({
            kind: 'function-call',
            name: 'memcpy',
            arguments: [
                { kind: 'raw-expression', expression: `(__rc_header*)c + 1` },
                {
                    kind: 'raw-expression',
                    expression:
                        '&(Containerˇfields){ .value = Integer¸fromCString("42"), .flag = c_true }',
                },
                {
                    kind: 'raw-expression',
                    expression: 'sizeof(Container) - sizeof(__rc_header)',
                },
            ],
        } satisfies CStatement)
    })

    it('lowers data literal with nested data field', () => {
        const program: SemanticProgramFixture = {
            body: [
                {
                    kind: 'data-decl',
                    name: 'Point',
                    fields: [
                        { name: 'x', type: 'truthvalue' },
                        { name: 'y', type: 'truthvalue' },
                    ],
                    position: somePosition,
                },
                {
                    kind: 'data-decl',
                    name: 'Pair',
                    fields: [{ name: 'p', type: 'Point' }],
                    position: somePosition,
                },
                {
                    kind: 'var-decl',
                    semantics: 'const',
                    name: 'pair',
                    valueSet: { type: 'Pair' },
                    value: {
                        kind: 'data-literal',
                        fields: {
                            p: {
                                kind: 'data-literal',
                                fields: {
                                    x: {
                                        kind: 'truthvalue',
                                        value: 'true',
                                        position: somePosition,
                                    },
                                    y: {
                                        kind: 'truthvalue',
                                        value: 'false',
                                        position: somePosition,
                                    },
                                },
                                position: somePosition,
                            },
                        },
                        position: somePosition,
                    },
                },
            ],
        }
        const module = new IRGenerator().generate(toModule(program))
        // memcpy(pair, &(Pairˇfields){ .p = &(Pointˇfields){ .x = c_true, .y = c_false } }, sizeof(Pair));
        expect(module.functions[0].body[1]).toMatchObject({
            kind: 'function-call',
            name: 'memcpy',
            arguments: [
                {
                    kind: 'raw-expression',
                    expression: `(__rc_header*)pair + 1`,
                },
                {
                    kind: 'raw-expression',
                    expression:
                        '&(Pairˇfields){ .p = &(Pointˇfields){ .x = c_true, .y = c_false } }',
                },
                {
                    kind: 'raw-expression',
                    expression: 'sizeof(Pair) - sizeof(__rc_header)',
                },
            ],
        } satisfies CStatement)
    })

    it('lowers field access and assignment', () => {
        const program: SemanticProgramFixture = {
            body: [
                {
                    kind: 'assign',
                    target: {
                        kind: 'field-access',
                        object: {
                            kind: 'identifier',
                            name: 'p',
                            position: somePosition,
                        },
                        field: 'x',
                        position: somePosition,
                    },
                    value: {
                        kind: 'truthvalue',
                        value: 'true',
                        position: somePosition,
                    },
                    position: somePosition,
                },
            ],
        }
        const module = new IRGenerator().generate(toModule(program))
        expect(module.functions[0].body[0]).toMatchObject({
            kind: 'function-call',
            name: 'mutateRC',
            arguments: [
                {
                    kind: 'var-ref',
                    name: 'p',
                },
            ],
        } satisfies CStatement)
        expect(module.functions[0].body[1]).toMatchObject({
            kind: 'assign',
            target: {
                kind: 'field-reference',
                object: { kind: 'var-ref', name: 'p' },
                field: 'x',
                deref: true,
            },
            value: { kind: 'var-ref', name: 'c_true' },
        } satisfies CStatement)
    })

    it('lowers array index assignment to checked array access', () => {
        const program: SemanticProgramFixture = {
            body: [
                {
                    kind: 'assign',
                    target: {
                        kind: 'array-index',
                        array: {
                            kind: 'identifier',
                            name: 'xs',
                            position: somePosition,
                        },
                        index: {
                            kind: 'integer',
                            value: 1n,
                            position: somePosition,
                        },
                        elementType: 'integer',
                        position: somePosition,
                    },
                    value: {
                        kind: 'integer',
                        value: 99n,
                        position: somePosition,
                    },
                    ownership: {},
                    position: somePosition,
                },
            ],
        }

        const module = new IRGenerator().generate(toModule(program))
        expect(module.functions[0].body[0]).toMatchObject({
            kind: 'assign',
            target: {
                kind: 'raw-expression',
                expression: 'ARRAY_ELEMENT_AT_CHECKED(1, xs, Integer*)',
            },
            value: {
                kind: 'function-call',
                name: 'Integer¸fromCString',
                arguments: [{ kind: 'string', value: '99' }],
            },
        } satisfies CStatement)
    })

    it('emits retainRC for reference type variable declaration', () => {
        const program: SemanticProgramFixture = {
            body: [
                {
                    kind: 'data-decl',
                    name: 'SomeRefType',
                    fields: [{ name: 'x', type: 'truthvalue' }],
                    position: somePosition,
                },
                {
                    kind: 'var-decl',
                    semantics: 'const',
                    name: 'refVar',
                    valueSet: { type: 'SomeRefType' },
                    value: {
                        kind: 'identifier',
                        name: 'otherRef',
                        position: somePosition,
                    },
                },
            ],
        }
        const module = new IRGenerator().generate(toModule(program))
        // Should emit a var-decl and a retainRC call
        expect(module.functions[0].body[0]).toMatchObject({
            kind: 'var-decl',
            name: 'refVar',
            type: 'SomeRefType*',
            value: { kind: 'var-ref', name: 'otherRef' },
        } satisfies CStatement)
        expect(module.functions[0].body[1]).toMatchObject({
            kind: 'function-call',
            name: 'retainRC',
            arguments: [{ kind: 'var-ref', name: 'refVar' }],
        } satisfies CStatement)
        expect(module.functions[0].body[2]).toMatchObject({
            kind: 'function-call',
            name: 'releaseRC',
            arguments: [{ kind: 'var-ref', name: 'refVar' }],
        } satisfies CStatement)
    })

    it('emits copyRC for reference declaration crossing semantics', () => {
        const program: SemanticProgramFixture = {
            body: [
                {
                    kind: 'data-decl',
                    name: 'SomeRefType',
                    fields: [{ name: 'x', type: 'truthvalue' }],
                    position: somePosition,
                },
                {
                    kind: 'var-decl',
                    semantics: 'mut',
                    name: 'isolated',
                    valueSet: { type: 'SomeRefType' },
                    value: {
                        kind: 'identifier',
                        name: 'sharedSource',
                        position: somePosition,
                    },
                    ownership: {
                        copyValueSemantics: '__rc_ISOLATED',
                        releaseAtScopeExit: true,
                    },
                },
            ],
        }

        const module = new IRGenerator().generate(toModule(program))
        expect(module.functions[0].body[0]).toMatchObject({
            kind: 'var-decl',
            name: 'isolated',
            type: 'SomeRefType*',
            value: {
                kind: 'function-call',
                name: 'copyRC',
                arguments: [
                    { kind: 'var-ref', name: 'sharedSource' },
                    { kind: 'var-ref', name: '__rc_ISOLATED' },
                ],
            },
        } satisfies CStatement)
    })

    it('emits retainRC and releaseRC on reference identifier reassign', () => {
        const program: SemanticProgramFixture = {
            body: [
                {
                    kind: 'data-decl',
                    name: 'SomeRefType',
                    fields: [{ name: 'x', type: 'truthvalue' }],
                    position: somePosition,
                },
                {
                    kind: 'var-decl',
                    semantics: 'mut',
                    name: 'refVar',
                    valueSet: { type: 'SomeRefType' },
                    value: {
                        kind: 'identifier',
                        name: 'lhs',
                        position: somePosition,
                    },
                },
                {
                    kind: 'assign',
                    target: {
                        kind: 'identifier',
                        name: 'refVar',
                        position: somePosition,
                    },
                    value: {
                        kind: 'identifier',
                        name: 'rhs',
                        position: somePosition,
                    },
                    position: somePosition,
                },
            ],
        }

        const module = new IRGenerator().generate(toModule(program))
        expect(module.functions[0].body[2]).toMatchObject({
            kind: 'function-call',
            name: 'retainRC',
            arguments: [{ kind: 'var-ref', name: 'rhs' }],
        } satisfies CStatement)
        expect(module.functions[0].body[3]).toMatchObject({
            kind: 'function-call',
            name: 'releaseRC',
            arguments: [{ kind: 'var-ref', name: 'refVar' }],
        } satisfies CStatement)
        expect(module.functions[0].body[4]).toMatchObject({
            kind: 'assign',
            target: { kind: 'var-ref', name: 'refVar' },
            value: { kind: 'var-ref', name: 'rhs' },
        } satisfies CStatement)
    })

    it('emits mutateRC for field assignment', () => {
        const program: SemanticProgramFixture = {
            body: [
                {
                    kind: 'assign',
                    target: {
                        kind: 'field-access',
                        object: {
                            kind: 'identifier',
                            name: 'outer',
                            position: somePosition,
                        },
                        field: 'inner',
                        position: somePosition,
                    },
                    value: {
                        kind: 'identifier',
                        name: 'newValue',
                        position: somePosition,
                    },
                    position: somePosition,
                },
            ],
        }
        const module = new IRGenerator().generate(toModule(program))
        // Should emit mutateRC for 'outer' before assignment
        expect(module.functions[0].body[0]).toMatchObject({
            kind: 'function-call',
            name: 'mutateRC',
            arguments: [{ kind: 'var-ref', name: 'outer' }],
        } satisfies CStatement)
        expect(module.functions[0].body[1]).toMatchObject({
            kind: 'assign',
            target: {
                kind: 'field-reference',
                object: { kind: 'var-ref', name: 'outer' },
                field: 'inner',
                deref: true,
            },
            value: { kind: 'var-ref', name: 'newValue' },
        } satisfies CStatement)
    })

    it('emits mutateRC for each container in nested field assignment', () => {
        const program: SemanticProgramFixture = {
            body: [
                {
                    kind: 'assign',
                    target: {
                        kind: 'field-access',
                        object: {
                            kind: 'field-access',
                            object: {
                                kind: 'identifier',
                                name: 'outer',
                                position: somePosition,
                            },
                            field: 'middle',
                            position: somePosition,
                        },
                        field: 'inner',
                        position: somePosition,
                    },
                    value: {
                        kind: 'identifier',
                        name: 'newValue',
                        position: somePosition,
                    },
                    position: somePosition,
                },
            ],
        }

        const module = new IRGenerator().generate(toModule(program))
        expect(module.functions[0].body[0]).toMatchObject({
            kind: 'function-call',
            name: 'mutateRC',
            arguments: [{ kind: 'var-ref', name: 'outer' }],
        } satisfies CStatement)
        expect(module.functions[0].body[1]).toMatchObject({
            kind: 'function-call',
            name: 'mutateRC',
            arguments: [
                {
                    kind: 'field-reference',
                    object: { kind: 'var-ref', name: 'outer' },
                    field: 'middle',
                    deref: true,
                },
            ],
        } satisfies CStatement)
    })

    it('emits copyRC for reference assignment crossing semantics', () => {
        const program: SemanticProgramFixture = {
            body: [
                {
                    kind: 'data-decl',
                    name: 'SomeRefType',
                    fields: [{ name: 'x', type: 'truthvalue' }],
                    position: somePosition,
                },
                {
                    kind: 'assign',
                    target: {
                        kind: 'identifier',
                        name: 'isolated',
                        position: somePosition,
                    },
                    value: {
                        kind: 'identifier',
                        name: 'sharedSource',
                        position: somePosition,
                    },
                    ownership: {
                        releases: [
                            {
                                kind: 'identifier',
                                name: 'isolated',
                                position: somePosition,
                            },
                        ],
                        copyValueSemantics: '__rc_ISOLATED',
                    },
                    position: somePosition,
                },
            ],
        }

        const module = new IRGenerator().generate(toModule(program))
        expect(module.functions[0].body[0]).toMatchObject({
            kind: 'function-call',
            name: 'releaseRC',
            arguments: [{ kind: 'var-ref', name: 'isolated' }],
        } satisfies CStatement)
        expect(module.functions[0].body[1]).toMatchObject({
            kind: 'assign',
            target: { kind: 'var-ref', name: 'isolated' },
            value: {
                kind: 'function-call',
                name: 'copyRC',
                arguments: [
                    { kind: 'var-ref', name: 'sharedSource' },
                    { kind: 'var-ref', name: '__rc_ISOLATED' },
                ],
            },
        } satisfies CStatement)
    })
})
