import { describe, expect, it } from 'bun:test'

import type * as cir from '../../../src/cir'
import { lowerDecl } from '../../../src/backend'

describe('Type declaration', () => {
    it('adds methods as mangled function names', () => {
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

    it('adds includes namespace in function names', () => {
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
})
