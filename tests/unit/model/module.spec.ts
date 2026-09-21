import { DataDeclaration } from '@/model/data-declaration'
import { decorateDomain } from '@/model/domain-declaration'
import { FunctionCall } from '@/model/function-call'
import { IntegerLiteral } from '@/model/integer-literal'
import { ISOLATED } from '@/model/isolation-level'
import { Module } from '@/model/module'
import { TypeName } from '@/model/type-name'
import { IntegerRange, TruthvalueSet } from '@/model/value-set'
import { VariableDeclaration } from '@/model/variable-declaration'
import { newSemanticContext, someCodeSpan } from '@@/util'
import { describe, expect, it } from 'bun:test'

describe('Module', () => {
    it('outputs the main block in CIR', () => {
        const module = Module.create({
            main: [
                FunctionCall.create({
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
                    span: someCodeSpan,
                }),
            ],
        })
        const result = module.toCIR(newSemanticContext())
        expect(result).toMatchObject({
            startBlock: [
                {
                    kind: 'CALL',
                    name: {
                        baseName: 'add',
                        labels: [],
                    },
                    arguments: [
                        {
                            kind: 'INTEGER_LITERAL',
                            value: { max: '1', min: '1' },
                        },
                        {
                            kind: 'INTEGER_LITERAL',
                            value: { max: '2', min: '2' },
                        },
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
                    name: TypeName.create({ name: 'MyData' }),
                    fields: [
                        {
                            name: 'field1',
                            isImmutable: false,
                            isolationLevel: ISOLATED,
                            domain: decorateDomain(
                                IntegerRange.unconstrained(),
                                { span: someCodeSpan },
                            ),
                        },
                        {
                            name: 'field2',
                            isImmutable: false,
                            isolationLevel: ISOLATED,
                            domain: decorateDomain(
                                IntegerRange.unconstrained(),
                                { span: someCodeSpan },
                            ),
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
                    kind: 'RC_TYPE_DECL',
                    name: 'MyData',
                },
            ],
        })
    })

    it('registers variables in the context', () => {
        const module = Module.create({
            main: [
                VariableDeclaration.create({
                    isImmutable: true,
                    name: 'x',
                    isolationLevel: ISOLATED,
                    domain: decorateDomain(IntegerRange.unconstrained(), {
                        span: someCodeSpan,
                    }),
                    initialValue: IntegerLiteral.create({
                        value: 42n,
                        span: someCodeSpan,
                    }),
                }),
            ],
        })
        const context = newSemanticContext()
        module.toCIR(context)
        expect(context.scope.variableDeclaration('x')).toEqual({
            isImmutable: true,
            isolationLevel: ISOLATED,
            domain: IntegerRange.create({ min: 42n, max: 42n }),
        })
    })

    it('registers data declarations in the context', () => {
        const module = Module.create({
            main: [],
            declarations: [
                DataDeclaration.create({
                    name: TypeName.create({ name: 'MyData' }),
                    fields: [
                        {
                            name: 'field1',
                            isImmutable: false,
                            isolationLevel: ISOLATED,
                            domain: decorateDomain(
                                IntegerRange.unconstrained(),
                                { span: someCodeSpan },
                            ),
                        },
                        {
                            name: 'field2',
                            isImmutable: false,
                            isolationLevel: ISOLATED,
                            domain: decorateDomain(
                                TruthvalueSet.unconstrained(),
                                { span: someCodeSpan },
                            ),
                        },
                    ],
                }),
            ],
        })
        const context = newSemanticContext()
        module.toCIR(context)
        const myDataDeclaration = context.scope.dataDeclaration(
            TypeName.create({ name: 'MyData' }),
        )
        expect(myDataDeclaration).toMatchObject({
            name: { name: 'MyData' },
            fields: [
                { name: 'field1', isImmutable: false },
                { name: 'field2', isImmutable: false },
            ],
        })
        expect(myDataDeclaration?.fields[0].domain).toBeInstanceOf(IntegerRange)
        expect(myDataDeclaration?.fields[1].domain).toBeInstanceOf(
            TruthvalueSet,
        )
    })
})
