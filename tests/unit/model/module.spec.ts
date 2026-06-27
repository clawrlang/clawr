import { describe, expect, it } from 'bun:test'
import { newSemanticContext, someCodeSpan } from '../../util'
import { Module } from '../../../src/model/module'
import { CallFunc } from '../../../src/model/call-func'
import { IntegerLiteral } from '../../../src/model/integer-literal'
import { DataDeclaration } from '../../../src/model/data-declaration'
import { VariableDeclaration } from '../../../src/model/variable-declaration'

describe('Module', () => {
    it('outputs the main block in CIR', () => {
        const module = Module.create({
            main: [
                CallFunc.create({
                    baseName: 'add',
                    arguments: [
                        {
                            value: IntegerLiteral.create({
                                value: 1n,
                                span: someCodeSpan,
                            }),
                        },
                        {
                            value: IntegerLiteral.create({
                                value: 2n,
                                span: someCodeSpan,
                            }),
                        },
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

    it('outputs data declarations in CIR', () => {
        const module = Module.create({
            main: [],
            declarations: [
                DataDeclaration.create({
                    name: 'MyData',
                    fields: [
                        { name: 'field1', type: 'integer', semantics: 'mut' },
                        {
                            name: 'field2',
                            type: 'truthvalue',
                            semantics: 'mut',
                        },
                    ],
                }),
            ],
        })
        const result = module.toCIR(newSemanticContext())
        expect(result).toMatchObject({
            startBlock: [],
            declarations: [
                {
                    kind: 'DATA_DECL',
                    name: 'MyData',
                },
            ],
        })
    })

    it('registers variables in the context', () => {
        const module = Module.create({
            main: [
                VariableDeclaration.create({
                    semantics: 'const',
                    name: 'x',
                    type: 'integer',
                    initialValue: IntegerLiteral.create({
                        value: 42n,
                        span: someCodeSpan,
                    }),
                }),
            ],
        })
        const context = newSemanticContext()
        module.toCIR(context)
        expect(context.scope.variables.get('x')).toEqual({
            semantics: 'const',
            type: 'integer',
        })
    })

    it('registers data declarations in the context', () => {
        const module = Module.create({
            main: [],
            declarations: [
                DataDeclaration.create({
                    name: 'MyData',
                    fields: [
                        { name: 'field1', type: 'integer', semantics: 'mut' },
                        {
                            name: 'field2',
                            type: 'truthvalue',
                            semantics: 'mut',
                        },
                    ],
                }),
            ],
        })
        const context = newSemanticContext()
        module.toCIR(context)
        expect(context.scope.declarations.get('MyData')).toMatchObject({
            name: 'MyData',
            fields: [
                { name: 'field1', type: 'integer' },
                { name: 'field2', type: 'truthvalue' },
            ],
        })
    })
})
