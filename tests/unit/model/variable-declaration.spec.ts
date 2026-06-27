import { describe, expect, it } from 'bun:test'
import { IntegerLiteral } from '../../../src/model/integer-literal'
import { VariableDeclaration } from '../../../src/model/variable-declaration'
import { newSemanticContext, someCodeSpan } from '../../util'
import { DataDeclaration } from '../../../src/model/data-declaration'
import { VariableReference } from '../../../src/model/variable-reference'
import { DataLiteral } from '../../../src/model/data-literal'

describe('VariableDeclaration', () => {
    it('converts to CIR VARIABLE_DECL', () => {
        const decl = VariableDeclaration.create({
            semantics: 'const',
            name: 'foo',
            type: 'integer',
            initialValue: IntegerLiteral.create(1n),
        })
        expect(decl.toCIR(newSemanticContext())).toEqual({
            kind: 'VARIABLE_DECL',
            name: 'foo',
            type: 'integer',
            initialValue: { kind: 'INTEGER_LITERAL', value: '1' },
        })
    })

    it('registers itself in the context', () => {
        const decl = VariableDeclaration.create({
            semantics: 'const',
            name: 'x',
            type: 'integer',
            initialValue: IntegerLiteral.create(42n),
        })
        const context = newSemanticContext()
        decl.toCIR(context)
        expect(context.scope.variables.get('x')).toEqual({
            semantics: 'const',
            type: 'integer',
        })
    })

    describe('throws if the value has incompatible semantics', () => {
        const cases = [
            { targetSemantics: ['mut', 'COW'], valueSemantics: ['ref', 'REF'] },
            {
                targetSemantics: ['mut', 'COW'],
                valueSemantics: ['mutref', 'REF'],
            },
        ] as const

        cases.forEach(({ targetSemantics, valueSemantics }) => {
            it(`${targetSemantics} target = ${valueSemantics} value`, () => {
                const context = newSemanticContext()
                context.scope.declarations.set(
                    'MyType',
                    DataDeclaration.create({
                        name: 'MyType',
                        fields: [
                            {
                                name: 'myField',
                                type: 'integer',
                                semantics: 'mut',
                            },
                        ],
                    }),
                )
                context.scope.variables.set('value', {
                    semantics: valueSemantics[0],
                    type: 'MyType',
                })

                const declaration = VariableDeclaration.create({
                    semantics: targetSemantics[0],
                    name: 'target',
                    type: 'MyType',
                    initialValue: VariableReference.create({
                        name: 'value',
                        span: someCodeSpan,
                    }),
                })
                expect(() => declaration.toCIR(context)).toThrow()
            })
        })

        it('does not throw if the value is UNIQUE', () => {
            const context = newSemanticContext()
            context.scope.declarations.set(
                'MyType',
                DataDeclaration.create({
                    name: 'MyType',
                    fields: [
                        {
                            name: 'myField',
                            type: 'integer',
                            semantics: 'mut',
                        },
                    ],
                }),
            )

            const declaration = VariableDeclaration.create({
                semantics: 'const',
                name: 'target',
                type: 'MyType',
                initialValue: DataLiteral.create([
                    {
                        name: 'myField',
                        value: IntegerLiteral.create(42n),
                    },
                ]),
            })
            expect(() => declaration.toCIR(context)).not.toThrow()
        })
    })
})
