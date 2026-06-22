import { describe, expect, it } from 'bun:test'
import { CallFunc, IntegerLiteral, Module } from '../../../src/model'

describe('Module', () => {
    it('outputs the main block', () => {
        const module = Module.create({
            main: [
                CallFunc.create({
                    baseName: 'add',
                    arguments: [
                        { value: IntegerLiteral.create(1n) },
                        { value: IntegerLiteral.create(2n) },
                    ],
                }),
            ],
        })
        const result = module.toCIR()
        expect(result).toMatchObject({
            startBlock: [
                {
                    type: 'CALL_FUNC',
                    signature: {
                        baseName: 'add',
                        parameters: [{ type: 'integer' }, { type: 'integer' }],
                    },
                    arguments: [
                        { type: 'INTEGER_LITERAL', value: '1' },
                        { type: 'INTEGER_LITERAL', value: '2' },
                    ],
                },
            ],
        })
    })
})
