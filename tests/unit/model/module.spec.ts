import { describe, expect, it } from 'bun:test'
import { newSemanticContext, someCodeSpan } from '@@/util'
import { Module } from '@/model/module'
import { CallFunc } from '@/model/call-func'
import { IntegerLiteral } from '@/model/integer-literal'
import { DataDeclaration } from '@/model/data-declaration'
import { VariableDeclaration } from '@/model/variable-declaration'
import { TypeName } from '@/model/type-name'
import { IntegerLattice, TruthvalueLattice } from '@/model/lattice'
import { ISOLATED } from '@/model/isolation-level'
import { decorateLattice } from '@/model/lattice-declaration'

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
                            lattice: decorateLattice(
                                IntegerLattice.unconstrained(),
                                { span: someCodeSpan },
                            ),
                        },
                        {
                            name: 'field2',
                            isImmutable: false,
                            isolationLevel: ISOLATED,
                            lattice: decorateLattice(
                                IntegerLattice.unconstrained(),
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
                    lattice: decorateLattice(IntegerLattice.unconstrained(), {
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
                            isolationLevel: ISOLATED,
                            lattice: decorateLattice(
                                IntegerLattice.unconstrained(),
                                { span: someCodeSpan },
                            ),
                        },
                        {
                            name: 'field2',
                            isImmutable: false,
                            isolationLevel: ISOLATED,
                            lattice: decorateLattice(
                                TruthvalueLattice.unconstrained(),
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
        expect(myDataDeclaration?.fields[0].lattice).toBeInstanceOf(
            IntegerLattice,
        )
        expect(myDataDeclaration?.fields[1].lattice).toBeInstanceOf(
            TruthvalueLattice,
        )
    })
})
