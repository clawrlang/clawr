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

    it('validates field manipulation and requires integer positions', () => {
        const operand = {
            kind: 'FIELD_FROM_STRING',
            value: {
                kind: 'STRING_LITERAL',
                type: { universe: 'string', value: '01' },
            },
            type: { universe: 'bitfield', length: 2 },
        }
        const count = {
            kind: 'INTEGER_LITERAL',
            type: { universe: 'integer', value: '1' },
        }
        const lane = {
            kind: 'FIELD_LANE',
            operand,
            index: count,
            type: { universe: 'truthvalue', values: ['false', 'true'] },
        }
        const slice = {
            kind: 'FIELD_SLICE',
            operand,
            start: count,
            length: count,
            type: { universe: 'bitfield', length: 1 },
        }
        const concat = {
            kind: 'FIELD_CONCAT',
            left: operand,
            right: slice,
            type: { universe: 'bitfield', length: 3 },
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
        for (const expression of [lane, slice, concat])
            expect(() => CIRParser.parse(module(expression))).not.toThrow()
        expect(() =>
            CIRParser.parse(module({ ...lane, index: operand })),
        ).toThrow('Invalid CIR:')
        expect(() =>
            CIRParser.parse(module({ ...slice, length: operand })),
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
            CIRParser.parse(
                module({
                    ...scope,
                    statements: [
                        {
                            kind: 'VARIABLE_DECL',
                            name: 'result',
                            type: scope.type,
                            initialValue: scope.value,
                        },
                        {
                            kind: 'IF',
                            condition: scope.value,
                            then: [
                                {
                                    kind: 'ASSIGN',
                                    target: {
                                        kind: 'VARIABLE_REF',
                                        name: 'result',
                                    },
                                    value: scope.value,
                                },
                            ],
                        },
                    ],
                }),
            ),
        ).not.toThrow()
        expect(() =>
            CIRParser.parse(module({ ...scope, statements: [{}] })),
        ).toThrow('Invalid CIR:')
        expect(() =>
            CIRParser.parse(module({ ...scope, cleanup: [{}] })),
        ).toThrow('Invalid CIR:')
    })

    it('validates conditional statements and logical negation recursively', () => {
        const value = {
            kind: 'TRUTHVALUE_LITERAL',
            type: { universe: 'truthvalue', value: 'ambiguous' },
        }
        const module = (condition: object, then: object[]) =>
            JSON.stringify({
                $schema: 'http://clawr.lang/schema/cir/DRAFT-0',
                startBlock: [{ kind: 'IF', condition, then, otherwise: [] }],
            })

        expect(() =>
            CIRParser.parse(
                module(
                    {
                        kind: 'NOT',
                        operand: value,
                        type: { universe: 'truthvalue', value: 'ambiguous' },
                    },
                    [{ kind: 'IF', condition: value, then: [] }],
                ),
            ),
        ).not.toThrow()
        expect(() => CIRParser.parse(module(value, [{}]))).toThrow(
            'Invalid CIR:',
        )
        expect(() =>
            CIRParser.parse(
                module(
                    {
                        kind: 'INTEGER_LITERAL',
                        type: { universe: 'integer', value: '1' },
                    },
                    [],
                ),
            ),
        ).toThrow('Invalid CIR:')
        expect(() =>
            CIRParser.parse(
                module(
                    {
                        kind: 'VARIABLE_REF',
                        name: 'boxed',
                        type: { universe: 'truthvalue', boxed: true },
                    },
                    [],
                ),
            ),
        ).toThrow('Invalid CIR:')
        expect(() =>
            CIRParser.parse(
                module(
                    {
                        kind: 'NOT',
                        operand: {
                            kind: 'INTEGER_LITERAL',
                            type: { universe: 'integer', value: '1' },
                        },
                        type: { universe: 'truthvalue' },
                    },
                    [],
                ),
            ),
        ).toThrow('Invalid CIR:')
    })

    it('validates loop conditions, bodies, and test order', () => {
        const loop = {
            kind: 'LOOP',
            condition: {
                kind: 'TRUTHVALUE_LITERAL',
                type: { universe: 'truthvalue', value: 'true' },
            },
            body: [],
            testAfter: false,
        }
        const module = (statement: object) =>
            JSON.stringify({
                $schema: 'http://clawr.lang/schema/cir/DRAFT-0',
                startBlock: [statement],
            })
        expect(() => CIRParser.parse(module(loop))).not.toThrow()
        expect(() =>
            CIRParser.parse(module({ ...loop, testAfter: true })),
        ).not.toThrow()
        expect(() =>
            CIRParser.parse(module({ ...loop, testAfter: 'yes' })),
        ).toThrow('Invalid CIR:')
        expect(() => CIRParser.parse(module({ ...loop, body: [{}] }))).toThrow(
            'Invalid CIR:',
        )
        expect(() =>
            CIRParser.parse(
                module({
                    ...loop,
                    condition: {
                        kind: 'INTEGER_LITERAL',
                        type: { universe: 'integer', value: '1' },
                    },
                }),
            ),
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
