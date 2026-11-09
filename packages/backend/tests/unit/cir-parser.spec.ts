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

    it('validates trait comparison operand and result types', () => {
        const operand = {
            kind: 'VARIABLE_REF',
            name: 'value',
            type: { universe: 'rc-type', name: 'Item' },
        }
        const expression = {
            kind: 'TRAIT_COMPARISON',
            operator: '<=',
            left: operand,
            right: operand,
            type: { universe: 'truthvalue' },
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
        expect(() => CIRParser.parse(module(expression))).not.toThrow()
        expect(() =>
            CIRParser.parse(
                module({
                    ...expression,
                    left: { ...operand, type: { universe: 'integer' } },
                }),
            ),
        ).toThrow('Invalid CIR:')
        expect(() =>
            CIRParser.parse(
                module({ ...expression, type: { universe: 'integer' } }),
            ),
        ).toThrow('Invalid CIR:')
    })
})
