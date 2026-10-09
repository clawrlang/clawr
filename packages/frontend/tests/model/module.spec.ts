import { DataDeclaration } from '@/model/data-declaration'
import { FunctionCall } from '@/model/function-call'
import { ISOLATED } from '@/model/isolation-level'
import { Module } from '@/model/module'
import { IntegerRange, TruthvalueSet } from '@/model/value-set'
import { VariableDeclaration } from '@/model/variable-declaration'
import * as util from '@@/util'
import { describe, expect, it } from 'bun:test'

describe('Module', () => {
    it('outputs the main block in CIR', () => {
        const module = Module.create({
            main: [
                FunctionCall.create({
                    baseName: 'add',
                    arguments: [
                        { value: util.integerLiteral(1) },
                        { value: util.integerLiteral(2) },
                    ],
                    span: util.someCodeSpan,
                }),
            ],
        })
        const result = module.toCIR(util.newSemanticContext())
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
                    name: util.simpleTypeName('MyData'),
                    properties: [
                        { ...util.somePropertyDeclConfig, name: 'property1' },
                        { ...util.somePropertyDeclConfig, name: 'property2' },
                    ],
                }),
            ],
        })
        const result = module.toCIR(util.newSemanticContext())
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
                    ...util.someVariableDeclConfig,
                    isImmutable: true,
                    name: 'x',
                    domain: util.spannedDomain(IntegerRange.unconstrained()),
                    initialValue: util.integerLiteral(42),
                }),
            ],
        })
        const context = util.newSemanticContext()
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
                    name: util.simpleTypeName('MyData'),
                    properties: [
                        { ...util.somePropertyDeclConfig, name: 'property1' },
                        {
                            ...util.somePropertyDeclConfig,
                            name: 'property2',
                            domain: util.spannedDomain(
                                TruthvalueSet.unconstrained(),
                            ),
                        },
                    ],
                }),
            ],
        })
        const context = util.newSemanticContext()
        module.toCIR(context)
        const myDataDeclaration = context.scope.dataDeclaration(
            util.simpleTypeName('MyData'),
        )
        expect(myDataDeclaration).toMatchObject({
            name: { name: 'MyData' },
            properties: [
                { name: 'property1', isImmutable: false },
                { name: 'property2', isImmutable: false },
            ],
        })
        expect(myDataDeclaration?.properties[0].domain).toBeInstanceOf(
            IntegerRange,
        )
        expect(myDataDeclaration?.properties[1].domain).toBeInstanceOf(
            TruthvalueSet,
        )
    })
})
