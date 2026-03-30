import { describe, expect, it } from 'bun:test'
import { ASTModule } from '../../src/ast'
import { IRGenerator } from '../../src/ir/ir-generator'
import { CStatement } from '../../src/ir'

describe('Lowering Tests', () => {
    it('lowers truthvalue variable declaration as truthvalue_t', () => {
        const program: ASTModule = {
            body: [
                {
                    kind: 'var-decl',
                    semantics: 'const',
                    name: 'x',
                    valueSet: { type: 'truthvalue' },
                    value: { kind: 'truthvalue', value: 'ambiguous' },
                },
            ],
        }
        const module = new IRGenerator().generate(program)
        expect(module.functions[0].body[0]).toMatchObject({
            kind: 'var-decl',
            type: 'truthvalue_t',
            name: 'x',
            value: { kind: 'var-ref', name: 'c_ambiguous' },
        } satisfies CStatement)
    })

    it('lowers integer variable declaration as Integer*', () => {
        const program: ASTModule = {
            body: [
                {
                    kind: 'var-decl',
                    semantics: 'const',
                    name: 'x',
                    valueSet: { type: 'integer' },
                    value: { kind: 'integer', value: 42n },
                },
            ],
        }
        const module = new IRGenerator().generate(program)
        expect(module.functions[0].body[0]).toMatchObject({
            kind: 'var-decl',
            type: 'Integer*',
            name: 'x',
            value: {
                kind: 'function-call',
                name: 'Integer¸withDigits',
                arguments: [
                    {
                        kind: 'function-call',
                        name: 'Array¸new',
                        arguments: [
                            { kind: 'raw-expression', expression: '1' },
                            { kind: 'raw-expression', expression: '42' },
                        ],
                    },
                ],
            },
        } satisfies CStatement)
    })

    it('lowers print of truthvalue literal correctly', () => {
        const program: ASTModule = {
            body: [
                {
                    kind: 'print',
                    value: { kind: 'truthvalue', value: 'true' },
                },
            ],
        }
        const module = new IRGenerator().generate(program)
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
        const program: ASTModule = {
            body: [
                {
                    kind: 'print',
                    value: { kind: 'integer', value: 42n },
                },
            ],
        }
        const module = new IRGenerator().generate(program)
        // Integer* temp0 = Integer¸withDigits(Array¸new(1, 42));
        expect(module.functions[0].body[0]).toMatchObject({
            kind: 'var-decl',
            name: 'temp0',
            type: 'Integer*',
            value: {
                kind: 'function-call',
                name: 'Integer¸withDigits',
                arguments: [
                    {
                        kind: 'function-call',
                        name: 'Array¸new',
                        arguments: [
                            { kind: 'raw-expression', expression: '1' },
                            { kind: 'raw-expression', expression: '42' },
                        ],
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
        const program: ASTModule = {
            body: [
                {
                    kind: 'var-decl',
                    semantics: 'const',
                    valueSet: { type: 'truthvalue' },
                    name: 'x',
                    value: { kind: 'truthvalue', value: 'ambiguous' },
                },
                {
                    kind: 'print',
                    value: { kind: 'identifier', name: 'x' },
                },
            ],
        }
        const module = new IRGenerator().generate(program)
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
        const program: ASTModule = {
            body: [
                {
                    kind: 'data-decl',
                    name: 'Point',
                    fields: [
                        { name: 'x', type: 'truthvalue' },
                        { name: 'y', type: 'truthvalue' },
                    ],
                },
            ],
        }

        const module = new IRGenerator().generate(program)
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
        const program: ASTModule = {
            body: [
                {
                    kind: 'data-decl',
                    name: 'Point',
                    fields: [
                        { name: 'x', type: 'truthvalue' },
                        { name: 'y', type: 'truthvalue' },
                    ],
                },
                {
                    kind: 'var-decl',
                    semantics: 'const',
                    name: 'p',
                    valueSet: { type: 'Point' },
                    value: {
                        kind: 'data-literal',
                        fields: {
                            x: { kind: 'truthvalue', value: 'true' },
                            y: { kind: 'truthvalue', value: 'false' },
                        },
                    },
                },
            ],
        }
        const module = new IRGenerator().generate(program)
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
        const program: ASTModule = {
            body: [
                {
                    kind: 'assign',
                    target: {
                        kind: 'field-access',
                        object: { kind: 'identifier', name: 'p' },
                        field: 'x',
                    },
                    value: { kind: 'truthvalue', value: 'true' },
                },
            ],
        }
        const module = new IRGenerator().generate(program)
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
        })
    })

    it('emits retainRC for reference type variable declaration', () => {
        const program: ASTModule = {
            body: [
                {
                    kind: 'var-decl',
                    semantics: 'const',
                    name: 'refVar',
                    valueSet: { type: 'SomeRefType' },
                    value: { kind: 'identifier', name: 'otherRef' },
                },
            ],
        }
        const module = new IRGenerator().generate(program)
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

    it('emits mutateRC for nested field assignment', () => {
        const program: ASTModule = {
            body: [
                {
                    kind: 'assign',
                    target: {
                        kind: 'field-access',
                        object: { kind: 'identifier', name: 'outer' },
                        field: 'inner',
                    },
                    value: { kind: 'identifier', name: 'newValue' },
                },
            ],
        }
        const module = new IRGenerator().generate(program)
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
        })
    })
})
