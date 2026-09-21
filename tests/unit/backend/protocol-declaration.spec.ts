import { lowerDecl } from '@/backend'
import type * as cir from '@/cir'
import { describe, expect, it } from 'bun:test'

describe('Interface Declaration', () => {
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
                            lattice: { type: 'truthvalue', values: ['false'] },
                        },
                    ],
                    lattice: { type: 'integer', max: '10', min: '0' },
                },
            ],
        }
        const result = lowerDecl(decl)
        expect(result).toContain('} MyInterfaceˇwitness;')
        expect(result).toContain(
            'int64_t (*slot˛l)(void* self, truthvalue_t p);',
        )
        expect(result).toContain('__interface_info MyInterfaceˇinfo ')
        expect(result).toContain('.name = "MyInterface"')
    })
})
