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

    it('validates scoped expressions and their statements', () => {
        const scope = {
            kind: 'SCOPE',
            statements: [],
            value: {
                kind: 'TRUTHVALUE_LITERAL',
                type: { universe: 'truthvalue', value: 'true' },
            },
            cleanup: [],
            type: { universe: 'truthvalue', value: 'true' },
        }
        const module = (value: object) =>
            JSON.stringify({
                $schema: 'http://clawr.lang/schema/cir/DRAFT-0',
                startBlock: [
                    {
                        kind: 'CALL',
                        name: { baseName: 'print', labels: [] },
                        arguments: [value],
                    },
                ],
            })
        expect(() => CIRParser.parse(module(scope))).not.toThrow()
        expect(() =>
            CIRParser.parse(module({ ...scope, cleanup: [{}] })),
        ).toThrow('Invalid CIR:')
    })
})
