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

    it('adds vtable for polymorphic methods', () => {
        const typeDecl: cir.Declaration = {
            kind: 'TYPE_DECL',
            name: 'MyType',
            fields: [],
            methods: [
                {
                    kind: 'FUNCTION_DECL',
                    polymorphic: true,
                    baseName: 'f',
                    parameters: [],
                    body: [],
                    resultValueSet: { type: 'integer' },
                },
            ],
        }

        const result = lowerDecl(typeDecl)
        expect(result).toContain(
            'typedef int64_t (*MyType·fˇmethod)(void* self);',
        )
        expect(result).toContain('MyType·fˇmethod f;')
        expect(result).toContain('MyTypeˇvtable;')
        expect(result).toContain('.polymorphic_type')
    })

    it('adds labels to vtable method names', () => {
        const typeDecl: cir.Declaration = {
            kind: 'TYPE_DECL',
            name: 'MyType',
            fields: [],
            methods: [
                {
                    kind: 'FUNCTION_DECL',
                    polymorphic: true,
                    baseName: 'f',
                    parameters: [
                        {
                            label: 'label',
                            varName: 'v',
                            valueSet: { type: 'integer' },
                        },
                    ],
                    body: [],
                    resultValueSet: { type: 'integer' },
                },
            ],
        }

        const result = lowerDecl(typeDecl)
        expect(result).toContain(
            '.f˛label = (MyType·f˛labelˇmethod)MyType·f˛label',
        )
        expect(result).toContain(
            'typedef int64_t (*MyType·f˛labelˇmethod)(void* self, int64_t v);',
        )
    })
})
