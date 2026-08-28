import { describe, expect, it } from 'bun:test'
import type * as cir from '../../../src/cir'
import { lowerDecl } from '../../../src/backend'

describe('Protocol Declaration', () => {
    it('is output correctly', () => {
        const decl: cir.Declaration = {
            kind: 'PROTOCOL_DECL',
            name: 'MyProtocol',
            requirements: [
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
        expect(result).toContain('} MyProtocolˇwitness;')
        expect(result).toContain(
            'int64_t (*slot˛l)(void* self, truthvalue_t p);',
        )
        expect(result).toContain('__protocol_info MyProtocolˇinfo ')
        expect(result).toContain('.name = "MyProtocol"')
    })
})
