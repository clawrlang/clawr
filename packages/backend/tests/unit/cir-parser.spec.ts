import { describe, expect, it } from 'bun:test'
import CIRParser from '../../src/cir-parser.js'
import { Ajv2020 } from 'ajv/dist/2020.js'
import cirSchema from '../../../../schema/cir.schema.json'
import declarations from '../../../../schema/declarations.json'
import expressions from '../../../../schema/expressions.json'
import statements from '../../../../schema/statements.json'
import valueSets from '../../../../schema/valuesets.json'

describe('CIR parser schema validation', () => {
    it('compiles schemas without strict type warnings', () => {
        expect(() =>
            new Ajv2020({ strictTypes: true })
                .addSchema(declarations, 'declarations.json')
                .addSchema(statements, 'statements.json')
                .addSchema(expressions, 'expressions.json')
                .addSchema(valueSets, 'valuesets.json')
                .compile(cirSchema),
        ).not.toThrow()
    })
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

    it('accepts RETAIN expressions for boxed value sets', () => {
        expect(() =>
            CIRParser.parse(
                JSON.stringify({
                    $schema: 'http://clawr.lang/schema/cir/DRAFT-0',
                    startBlock: [
                        {
                            kind: 'CALL',
                            name: { baseName: 'consume', labels: [] },
                            arguments: [
                                {
                                    kind: 'RETAIN',
                                    object: {
                                        kind: 'VARIABLE_REF',
                                        name: 'value',
                                    },
                                    type: { universe: 'integer', boxed: true },
                                },
                            ],
                        },
                    ],
                }),
            ),
        ).not.toThrow()
    })
})
