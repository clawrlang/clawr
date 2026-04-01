import { describe, expect, it } from 'bun:test'
import {
    SemanticDataDeclaration,
    SemanticModule,
    SemanticStatement,
} from '../../src/semantic-analyzer'
import { IRGenerator } from '../../src/ir/ir-generator'
import { CStatement } from '../../src/ir'

const somePosition = { line: 1, column: 1 }

type SemanticProgramFixture = {
    body: (SemanticDataDeclaration | SemanticStatement)[]
}

function toModule(program: SemanticProgramFixture): SemanticModule {
    return {
        functions: [
            {
                kind: 'function',
                name: 'main',
                body: program.body.filter(
                    (stmt): stmt is SemanticStatement =>
                        stmt.kind !== 'data-decl',
                ),
            },
        ],
        types: program.body.filter(
            (stmt): stmt is SemanticDataDeclaration =>
                stmt.kind === 'data-decl',
        ),
        globals: [],
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
                name: 'Integer¸fromStringRC',
                arguments: [
                    {
                        kind: 'function-call',
                        name: 'String¸fromCString',
                        arguments: [{ kind: 'string', value: '42' }],
                    },
                ],
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
        // Integer* temp0 = Integer¸fromStringRC(String¸fromCString("42"));
        expect(module.functions[0].body[0]).toMatchObject({
            kind: 'var-decl',
            name: 'temp0',
            type: 'Integer*',
            value: {
                kind: 'function-call',
                name: 'Integer¸fromStringRC',
                arguments: [
                    {
                        kind: 'function-call',
                        name: 'String¸fromCString',
                        arguments: [{ kind: 'string', value: '42' }],
                    },
                ],
            },
        } satisfies CStatement)
        // String* temp1 = Integer·toStringRC(temp0);
        expect(module.functions[0].body[1]).toMatchObject({
            kind: 'var-decl',
            name: 'temp1',
            type: 'String*',
            value: {
                kind: 'function-call',
                name: 'Integer·toStringRC',
                arguments: [{ kind: 'var-ref', name: 'temp0' }],
            },
        } satisfies CStatement)
        // printf("%s\n", temp1);
        expect(module.functions[0].body[2]).toMatchObject({
            kind: 'function-call',
            name: 'printf',
            arguments: [
                { kind: 'string', value: '%s\\n' },
                { kind: 'var-ref', name: 'temp1' },
            ],
        } satisfies CStatement)
        // releaseRC(temp0);
        expect(module.functions[0].body[3]).toMatchObject({
            kind: 'function-call',
            name: 'releaseRC',
            arguments: [{ kind: 'var-ref', name: 'temp0' }],
        } satisfies CStatement)
        // releaseRC(temp1);
        expect(module.functions[0].body[4]).toMatchObject({
            kind: 'function-call',
            name: 'releaseRC',
            arguments: [{ kind: 'var-ref', name: 'temp1' }],
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
                        },
                    },
                },
            },
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

    it('emits retainRC for reference type variable declaration', () => {
        const program: SemanticProgramFixture = {
            body: [
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
})
