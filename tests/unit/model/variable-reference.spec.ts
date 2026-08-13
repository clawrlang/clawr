import { describe, expect, it, test } from 'bun:test'
import { VariableReference } from '../../../src/model/variable-reference'
import { newSemanticContext, someCodeSpan } from '../../util'
import { DataDeclaration } from '../../../src/model/data-declaration'
import { ExplicitIntegerValueSet } from '../../../src/model/explicit-value-set'
import { IntegerLattice, RCTypeLattice } from '../../../src/model/lattice'
import { TypeName } from '../../../src/model/type-name'

describe('Variable Reference', () => {
    it('generates correct CIR', () => {
        const context = newSemanticContext()
        context.scope.variables.set('myVar', {
            isImmutable: true,
            isolationLevel: 'ISOLATED',
            lattice: IntegerLattice.create({ min: 10n, max: 10n }),
        })

        const variableRef = VariableReference.create({
            name: 'myVar',
            span: someCodeSpan,
        })
        expect(variableRef.toCIRExpression(context).value()).toMatchObject({
            kind: 'VARIABLE_REF',
            name: 'myVar',
        })
    })

    it('throws if variable is not in context', () => {
        const span = {
            start: { line: 1, column: 1 },
            end: { line: 1, column: 6 },
        }
        const variableRef = VariableReference.create({ name: 'myVar', span })

        const context = newSemanticContext()
        const result = variableRef.toCIRExpression(context)
        expect(result.isFailure()).toBeTrue()
        expect(result.getError().errors[0]).toMatchObject({
            message: `Variable myVar is not defined in the current context`,
            span,
        })
    })

    it('infers its type from the context', () => {
        const context = newSemanticContext()
        context.scope.variables.set('myVar', {
            isImmutable: true,
            isolationLevel: 'ISOLATED',
            lattice: IntegerLattice.create({ min: 10n, max: 10n }),
        })

        const variableRef = VariableReference.create({
            name: 'myVar',
            span: someCodeSpan,
        })
        expect(variableRef.declaredValueSet(context).value()).toEqual(
            IntegerLattice.create({ min: 10n, max: 10n }),
        )
    })

    it('has the same current value as the referenced variable', () => {
        const context = newSemanticContext()
        context.scope.variables.set('myVar', {
            isImmutable: true,
            isolationLevel: 'ISOLATED',
            lattice: IntegerLattice.create({ min: 10n, max: 10n }),
        })
        context.scope.setCurrentValue(
            'myVar',
            IntegerLattice.create({ min: 10n, max: 10n }),
        )

        const variableRef = VariableReference.create({
            name: 'myVar',
            span: someCodeSpan,
        })
        expect(variableRef.currentValue(context).value()).toMatchObject({
            min: 10n,
            max: 10n,
        })
    })

    describe('infers isolation level from the context', () => {
        const cases = [
            { kind: 'const', expected: 'ISOLATED' },
            { kind: 'mut', expected: 'ISOLATED' },
            { kind: 'ref', expected: 'SHARED' },
            { kind: 'mutref', expected: 'SHARED' },
        ] as const

        const context = newSemanticContext()
        context.scope.rootScope.addDataDeclaration(
            TypeName.create({ name: 'MyType' }),
            DataDeclaration.create({
                name: TypeName.create({ name: 'MyType' }),
                fields: [
                    {
                        name: 'myField',
                        valueSet: ExplicitIntegerValueSet.create({
                            span: someCodeSpan,
                        }),
                        semantics: 'mut',
                    },
                ],
            }),
        )

        for (const { kind, expected } of cases) {
            it(`returns ${expected} for ${kind} variable`, () => {
                context.scope.variables.set('myVar', {
                    isImmutable: kind === 'const' || kind === 'ref',
                    isolationLevel:
                        kind === 'ref' || kind === 'mutref'
                            ? 'SHARED'
                            : 'ISOLATED',
                    lattice: RCTypeLattice.create({
                        type: TypeName.create({ name: 'MyType' }),
                        semantics: expected,
                    }),
                })

                const variableRef = VariableReference.create({
                    name: 'myVar',
                    span: someCodeSpan,
                })
                expect(variableRef.isolationLevel(context)).toEqual(expected)
            })
        }
    })
})
