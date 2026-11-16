import { lowerDecl } from '@clawr/backend'
import type * as cir from '@clawr/cir'
import { describe, expect, it } from 'bun:test'

describe('Interface Declaration', () => {
    it('reuses runtime-owned identities without suppressing Clawr-defined stdlib interfaces', () => {
        expect(
            lowerDecl({
                kind: 'INTERFACE_DECL',
                namespace: 'clawr',
                name: 'Serializable',
                methods: [],
            }),
        ).toBe('')
        expect(
            lowerDecl({
                kind: 'INTERFACE_DECL',
                namespace: 'clawr',
                name: 'CustomWriter',
                methods: [],
            }),
        ).toContain('__interface_info clawr¸CustomWriterˇtype')
    })

    it('is output correctly', () => {
        const decl: cir.Declaration = {
            kind: 'INTERFACE_DECL',
            name: 'MyInterface',
            methods: [
                {
                    baseName: 'slot',
                    labels: ['l'],
                    parameters: [
                        {
                            name: 'p',
                            type: {
                                universe: 'truthvalue',
                                values: ['false'],
                            },
                        },
                    ],
                    returnType: { universe: 'integer', max: '10', min: '0' },
                },
            ],
        }
        const result = lowerDecl(decl)
        expect(result).toContain('} MyInterfaceˇwitness;')
        expect(result).toContain(
            'int64_t (*slot˛l)(void* self, truthvalue_t p);',
        )
        expect(result).toContain('__interface_info MyInterfaceˇtype ')
        expect(result).toContain('.name = "MyInterface"')
    })
})
