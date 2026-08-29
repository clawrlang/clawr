import { describe, expect, it } from 'bun:test'

import type * as cir from '@/cir'
import { lowerDecl } from '@/backend'
import { SHARED } from '@/model/isolation-level'

describe('Type declaration', () => {
    describe('fields', () => {
        it('adds fields to the type struct', () => {
            const typeDecl: cir.Declaration = {
                kind: 'RC_TYPE_DECL',
                name: 'MyData',
                fields: [
                    {
                        name: 'field',
                        lattice: {
                            type: 'integer',
                            min: '0',
                            max: '100',
                        },
                    },
                ],
            }
            const result = lowerDecl(typeDecl)
            expect(result).toContain('typedef struct')
            expect(result).toContain('int64_t field;')
        })

        it('adds super fields to inherited types', () => {
            const typeDecl: cir.Declaration = {
                kind: 'RC_TYPE_DECL',
                name: 'Sub',
                base: { name: 'Super' },
                fields: [
                    {
                        name: 'field',
                        lattice: {
                            type: 'integer',
                            min: '0',
                            max: '100',
                        },
                    },
                ],
                methods: [],
            }
            const result = lowerDecl(typeDecl)
            expect(result).toContain('typedef struct')
            expect(result).toContain('Super super;')
            expect(result).toContain('int64_t field;')
        })
    })

    it('adds methods as functions with mangled names', () => {
        const typeDecl: cir.Declaration = {
            kind: 'RC_TYPE_DECL',
            name: 'MyType',
            fields: [],
            methods: [
                {
                    kind: 'FUNCTION_DECL',
                    baseName: 'myMethod',
                    labels: [],
                    parameters: [],
                    body: [],
                },
            ],
        }

        const result = lowerDecl(typeDecl)
        expect(result).toContain('void MyType·myMethod(MyType* self) {')
    })

    it('includes namespace in mangled method names', () => {
        const typeDecl: cir.Declaration = {
            kind: 'RC_TYPE_DECL',
            namespace: 'my_namespace',
            name: 'MyType',
            fields: [],
            methods: [
                {
                    kind: 'FUNCTION_DECL',
                    baseName: 'myMethod',
                    labels: [],
                    parameters: [],
                    body: [],
                },
            ],
        }

        const result = lowerDecl(typeDecl)
        expect(result).toContain(
            'void my_namespace¸MyType·myMethod(MyType* self) {',
        )
    })

    it('includes namespace in mangled free-function names', () => {
        const typeDecl: cir.Declaration = {
            kind: 'FUNCTION_DECL',
            namespace: 'MyType',
            baseName: 'myCompanionMethod',
            labels: [],
            parameters: [],
            body: [],
        }

        const result = lowerDecl(typeDecl)
        expect(result).toContain('void MyType¸myCompanionMethod() {')
    })

    it('declares vtable for polymorphic methods', () => {
        const typeDecl: cir.Declaration = {
            kind: 'RC_TYPE_DECL',
            name: 'MyType',
            fields: [],
            methods: [
                {
                    kind: 'FUNCTION_DECL',
                    baseName: 'f',
                    labels: [],
                    parameters: [],
                    body: [],
                    lattice: { type: 'integer' },
                },
            ],
            dispatchTable: [
                {
                    slot: {
                        baseName: 'f',
                        labels: [],
                        parameters: [],
                        lattice: { type: 'integer' },
                    },
                    declaredIn: { name: 'MyType' },
                    implementation: { name: 'MyType' },
                },
            ],
        }

        const result = lowerDecl(typeDecl)
        expect(result).toContain(
            'typedef int64_t (*MyType·fˇmethod)(void* self);',
        )
        expect(result).toContain('(MyType·fˇmethod)MyType·f,')
        expect(result).toContain('MyType·fˇmethod f;')
        expect(result).toContain('MyTypeˇvtable;')
        expect(result).toContain('.polymorphic_type')
    })

    it('adds labels to vtable method names', () => {
        const typeDecl: cir.Declaration = {
            kind: 'RC_TYPE_DECL',
            name: 'MyType',
            fields: [],
            methods: [],
            dispatchTable: [
                {
                    slot: {
                        baseName: 'f',
                        labels: ['label'],
                        parameters: [
                            {
                                name: 'v',
                                lattice: { type: 'integer' },
                            },
                        ],
                        lattice: { type: 'integer' },
                    },
                    declaredIn: { name: 'MyType' },
                    implementation: { name: 'MyType' },
                },
            ],
        }

        const result = lowerDecl(typeDecl)
        expect(result).toContain(
            'typedef int64_t (*MyType·f˛labelˇmethod)(void* self, int64_t v);',
        )
        expect(result).toContain(
            '.f˛label = (MyType·f˛labelˇmethod)MyType·f˛label',
        )
    })

    it('adds vtable for subtypes', () => {
        const typeDecl: cir.Declaration = {
            kind: 'RC_TYPE_DECL',
            name: 'Sub',
            base: { name: 'Super' },
            fields: [],
            methods: [
                {
                    kind: 'FUNCTION_DECL',
                    baseName: 'f',
                    labels: [],
                    parameters: [],
                    body: [],
                    lattice: { type: 'integer' },
                },
            ],
            dispatchTable: [
                {
                    slot: { baseName: 'f', labels: [], parameters: [] },
                    declaredIn: { name: 'Super' },
                    implementation: { name: 'Sub' },
                },
            ],
        }

        const result = lowerDecl(typeDecl)
        expect(result).toContain('(Super·fˇmethod)Sub·f,')
        expect(result).toContain('.polymorphic_type')
    })

    it('adds initializers', () => {
        const typeDecl: cir.Declaration = {
            kind: 'RC_TYPE_DECL',
            name: 'Super',
            fields: [],
            methods: [],
            initializers: [
                {
                    kind: 'FUNCTION_DECL',
                    baseName: 'init',
                    labels: ['field'],
                    parameters: [
                        {
                            name: 'field',
                            lattice: {
                                type: 'integer',
                                min: '0',
                                max: '100',
                            },
                        },
                    ],
                    body: [
                        {
                            kind: 'ASSIGN',
                            target: {
                                kind: 'VARIABLE_REF',
                                name: 'self',
                            },
                            value: {
                                kind: 'ALLOCATION',
                                isolationLevel: SHARED,
                                fields: [],
                                value: { type: 'rc-type', name: 'Super' },
                            },
                        },
                    ],
                },
            ],
        }

        const result = lowerDecl(typeDecl)
        expect(result).toContain(
            'void* Super·init˛field(Super* self, int64_t field) {',
        )
        expect(result).toContain('memcpy(&self->fields, &(Superˇfields){')
        expect(result).toContain('.field = field,')
        expect(result).toContain('return self;')
    })
})
