import { describe, expect, it } from 'bun:test'
import { CallFunc, IntegerLiteral, Module } from '../../../src/model'
import { newSemanticContext } from '../../util'

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
        const result = module.toCIR(newSemanticContext())
        expect(result).toMatchObject({
            startBlock: [
                {
                    kind: 'CALL_FUNC',
                    signature: {
                        baseName: 'add',
                        parameters: [{ type: 'integer' }, { type: 'integer' }],
                    },
                    arguments: [
                        { kind: 'INTEGER_LITERAL', value: '1' },
                        { kind: 'INTEGER_LITERAL', value: '2' },
                    ],
                },
            ],
        })
    })
})
