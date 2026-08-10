import { describe, expect, it } from 'bun:test'

import type * as cir from '../../../src/cir'
import { lowerDecl } from '../../../src/backend'

describe('Type declaration', () => {
    it('adds methods as functions with mangled names', () => {
        const typeDecl: cir.Declaration = {
            kind: 'TYPE_DECL',
            name: 'MyType',
            fields: [],
            methods: [
                {
                    kind: 'FUNCTION_DECL',
                    baseName: 'myMethod',
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
            kind: 'TYPE_DECL',
            namespace: 'my_namespace',
            name: 'MyType',
            fields: [],
            methods: [
                {
                    kind: 'FUNCTION_DECL',
                    baseName: 'myMethod',
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
            parameters: [],
            body: [],
        }

        const result = lowerDecl(typeDecl)
        expect(result).toContain('void MyType¸myCompanionMethod() {')
    })

    it('declares vtable for polymorphic methods', () => {
        const typeDecl: cir.Declaration = {
            kind: 'TYPE_DECL',
            name: 'MyType',
            fields: [],
            methods: [
                {
                    kind: 'FUNCTION_DECL',
                    baseName: 'f',
                    parameters: [],
                    body: [],
                    resultValueSet: { type: 'integer' },
                },
            ],
            dispatchTable: [
                {
                    slot: {
                        baseName: 'f',
                        parameters: [],
                        resultValueSet: { type: 'integer' },
                    },
                    declaredIn: { name: 'MyType' },
                    implementedBy: { name: 'MyType' },
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
            kind: 'TYPE_DECL',
            name: 'MyType',
            fields: [],
            methods: [],
            dispatchTable: [
                {
                    slot: {
                        baseName: 'f',
                        parameters: [
                            {
                                label: 'label',
                                varName: 'v',
                                valueSet: { type: 'integer' },
                            },
                        ],
                        resultValueSet: { type: 'integer' },
                    },
                    declaredIn: { name: 'MyType' },
                    implementedBy: { name: 'MyType' },
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
            kind: 'TYPE_DECL',
            name: 'Sub',
            base: { type: 'Super' },
            fields: [],
            methods: [
                {
                    kind: 'FUNCTION_DECL',
                    baseName: 'f',
                    parameters: [],
                    body: [],
                    resultValueSet: { type: 'integer' },
                },
            ],
            dispatchTable: [
                {
                    slot: { baseName: 'f', parameters: [] },
                    declaredIn: { name: 'Super' },
                    implementedBy: { name: 'Sub' },
                },
            ],
        }

        const result = lowerDecl(typeDecl)
        expect(result).toContain('(Super·fˇmethod)Sub·f,')
        expect(result).toContain('.polymorphic_type')
    })

    it('adds initializers', () => {
        const typeDecl: cir.Declaration = {
            kind: 'TYPE_DECL',
            name: 'Super',
            fields: [],
            methods: [],
            initializers: [
                {
                    kind: 'FUNCTION_DECL',
                    baseName: 'init',
                    parameters: [
                        {
                            label: 'field',
                            varName: 'field',
                            valueSet: {
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
                                valueSet: {
                                    type: 'rc-type',
                                    typeName: 'Super',
                                    semantics: 'SHARED',
                                },
                            },
                            value: {
                                kind: 'ALLOCATION',
                                fields: [],
                                valueSet: {
                                    type: 'rc-type',
                                    typeName: 'Super',
                                    semantics: 'SHARED',
                                },
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
