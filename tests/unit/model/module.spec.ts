import { describe, expect, it } from 'bun:test'
import { newSemanticContext, someCodeSpan } from '../../util'
import { Module } from '../../../src/model/module'
import { CallFunc } from '../../../src/model/call-func'
import { IntegerLiteral } from '../../../src/model/integer-literal'
import { DataDeclaration } from '../../../src/model/data-declaration'
import { VariableDeclaration } from '../../../src/model/variable-declaration'
import {
    ExplicitIntegerValueSet,
    ExplicitTruthValueSet,
} from '../../../src/model/explicit-value-set'
import { TypeName } from '../../../src/model/type-name'
import { IntegerLattice } from '../../../src/model/lattice'
import { ISOLATED } from '../../../src/model/isolation-level'

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
                    kind: 'CALL',
                    name: {
                        baseName: 'add',
                        labels: [],
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
                    name: TypeName.create({ name: 'MyData' }),
                    fields: [
                        {
                            name: 'field1',
                            isImmutable: false,
                            valueSet: ExplicitIntegerValueSet.create({
                                span: someCodeSpan,
                            }),
                        },
                        {
                            name: 'field2',
                            isImmutable: false,
                            valueSet: ExplicitTruthValueSet.create({
                                span: someCodeSpan,
                            }),
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
                    kind: 'TYPE_DECL',
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
                    valueSet: ExplicitIntegerValueSet.create({
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
            lattice: IntegerLattice.create({ min: 42n, max: 42n }),
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
                            valueSet: ExplicitIntegerValueSet.create({
                                span: someCodeSpan,
                            }),
                        },
                        {
                            name: 'field2',
                            isImmutable: false,
                            valueSet: ExplicitTruthValueSet.create({
                                span: someCodeSpan,
                            }),
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
        expect(myDataDeclaration?.fields[0].valueSet).toBeInstanceOf(
            ExplicitIntegerValueSet,
        )
        expect(myDataDeclaration?.fields[1].valueSet).toBeInstanceOf(
            ExplicitTruthValueSet,
        )
    })
})
