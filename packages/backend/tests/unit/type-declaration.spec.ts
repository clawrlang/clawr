import { describe, expect, it } from 'bun:test'

import { lowerDecl } from '@clawr/backend'
import type * as cir from '@clawr/cir'

describe('Type declaration', () => {
    describe('properties', () => {
        it('adds properties to the type struct', () => {
            const typeDecl: cir.Declaration = {
                kind: 'RC_TYPE_DECL',
                name: 'MyData',
                properties: [
                    {
                        name: 'property',
                        domain: {
                            type: 'integer',
                            min: '0',
                            max: '100',
                        },
                    },
                ],
            }
            const result = lowerDecl(typeDecl)
            expect(result).toContain('typedef struct')
            expect(result).toContain('int64_t property;')
        })

        it('adds super properties to inherited types', () => {
            const typeDecl: cir.Declaration = {
                kind: 'RC_TYPE_DECL',
                name: 'Sub',
                base: { name: 'Super' },
                properties: [
                    {
                        name: 'property',
                        domain: {
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
            expect(result).toContain('int64_t property;')
        })
    })

    it('adds methods as functions with mangled names', () => {
        const typeDecl: cir.Declaration = {
            kind: 'RC_TYPE_DECL',
            name: 'MyType',
            properties: [],
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
        expect(result).toContain('void MyType·myMethod(void* cˇself) {')
        expect(result).toContain('MyType* self = cˇself;')
    })

    it('includes namespace in mangled method names', () => {
        const typeDecl: cir.Declaration = {
            kind: 'RC_TYPE_DECL',
            namespace: 'my_namespace',
            name: 'MyType',
            properties: [],
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
            'void my_namespace¸MyType·myMethod(void* cˇself) {',
        )
        expect(result).toContain('MyType* self = cˇself;')
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
            properties: [],
            methods: [
                {
                    kind: 'FUNCTION_DECL',
                    baseName: 'f',
                    labels: [],
                    parameters: [],
                    body: [],
                    domain: { type: 'integer' },
                },
            ],
            dispatchTable: [
                {
                    slot: {
                        baseName: 'f',
                        labels: [],
                        parameters: [],
                        domain: { type: 'integer' },
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
            properties: [],
            methods: [],
            dispatchTable: [
                {
                    slot: {
                        baseName: 'f',
                        labels: ['label'],
                        parameters: [
                            {
                                name: 'v',
                                domain: { type: 'integer' },
                            },
                        ],
                        domain: { type: 'integer' },
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
            properties: [],
            methods: [
                {
                    kind: 'FUNCTION_DECL',
                    baseName: 'f',
                    labels: [],
                    parameters: [],
                    body: [],
                    domain: { type: 'integer' },
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
            properties: [],
            methods: [],
            initializers: [
                {
                    kind: 'FUNCTION_DECL',
                    baseName: 'setup',
                    labels: ['property'],
                    parameters: [
                        {
                            name: 'property',
                            domain: {
                                type: 'integer',
                                min: '0',
                                max: '100',
                            },
                        },
                    ],
                    body: [
                        {
                            kind: 'SELF_ASSIGN',
                            value: {
                                kind: 'DATA',
                                properties: [
                                    {
                                        name: 'property',
                                        value: {
                                            kind: 'VARIABLE_REF',
                                            name: 'property',
                                            domain: { type: 'integer' },
                                        },
                                    },
                                ],
                                domain: { type: 'rc-type', name: 'Super' },
                            },
                        },
                    ],
                },
            ],
        }

        const result = lowerDecl(typeDecl)
        expect(result).toContain(
            'void* Super·setup˛property(void* cˇself, int64_t property) {',
        )
        expect(result).toContain('Super* self = cˇself;')
        expect(result).toContain(
            'memcpy(&self->properties, &(Superˇproperties){',
        )
        expect(result).toContain('.property = property')
        expect(result).toContain('return self;')
    })
})
