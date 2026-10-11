import { describe, expect, it } from 'bun:test'
import CIRParser from '../../src/cir-parser.js'

describe('CIR parser schema validation', () => {
    it('parses valid JSON using the CIR schema', () => {
        const result = CIRParser.parse(
            '{"$schema":"http://clawr.lang/schema/cir/DRAFT-0","startBlock":[]}',
        )

        expect(result.startBlock).toEqual([])
    })

    it('parses valid YAML using the CIR schema', () => {
        const result = CIRParser.parse(
            "$schema: 'http://clawr.lang/schema/cir/DRAFT-0'\nstartBlock: []",
        )

        expect(result.startBlock).toEqual([])
    })

    it('rejects data that does not match the CIR schema', () => {
        expect(() =>
            CIRParser.parse(
                '{"$schema":"http://clawr.lang/schema/cir/DRAFT-0","unexpected":true}',
            ),
        ).toThrow('Invalid CIR:')
    })
})
