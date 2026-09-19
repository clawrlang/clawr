import { DataDeclaration } from '@/model/data-declaration'
import { ISOLATED, SHARED } from '@/model/isolation-level'
import { IntegerLattice, RCTypeLattice } from '@/model/lattice'
import { decorateLattice } from '@/model/lattice-declaration'
import { TypeName } from '@/model/type-name'
import { VariableReference } from '@/model/variable-reference'
import { newSemanticContext, someCodeSpan } from '@@/util'
import { describe, expect, it, test } from 'bun:test'

describe('Variable Reference', () => {
    it('generates correct CIR', () => {
        const context = newSemanticContext()
        context.scope.addVariableDeclaration('myVar', {
            isImmutable: true,
            isolationLevel: ISOLATED,
            lattice: IntegerLattice.create({ min: 10n, max: 10n }),
        })

        const variableRef = VariableReference.create({
            name: 'myVar',
            span: someCodeSpan,
        })
        const result = variableRef.toCIRExpression(context)
        expect(result.isSuccess && result.value).toMatchObject({
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
        expect(result.isError && result.error.errors[0]).toMatchObject({
            message: `Variable myVar is not defined in the current context`,
            span,
        })
    })

    it('infers its type from the context', () => {
        const context = newSemanticContext()
        context.scope.addVariableDeclaration('myVar', {
            isImmutable: true,
            isolationLevel: ISOLATED,
            lattice: IntegerLattice.create({ min: 10n, max: 10n }),
        })

        const variableRef = VariableReference.create({
            name: 'myVar',
            span: someCodeSpan,
        })
        const result = variableRef.declaredLattice(context)
        expect(result.isSuccess && result.value).toEqual(
            IntegerLattice.create({ min: 10n, max: 10n }),
        )
    })

    it('has the same current value as the referenced variable', () => {
        const context = newSemanticContext()
        context.scope.addVariableDeclaration('myVar', {
            isImmutable: true,
            isolationLevel: ISOLATED,
            lattice: IntegerLattice.create({ min: 10n, max: 10n }),
        })

        const variableRef = VariableReference.create({
            name: 'myVar',
            span: someCodeSpan,
        })
        const result = variableRef.currentValue(context)
        expect(result.isSuccess && result.value).toMatchObject({
            min: 10n,
            max: 10n,
        })
    })

    describe('infers isolation level from the context', () => {
        const cases = [ISOLATED, SHARED] as const

        const context = newSemanticContext()
        context.scope.rootScope.addDataDeclaration(
            DataDeclaration.create({
                name: TypeName.create({ name: 'MyType' }),
                fields: [
                    {
                        isImmutable: false,
                        name: 'myField',
                        isolationLevel: ISOLATED,
                        lattice: decorateLattice(
                            IntegerLattice.unconstrained(),
                            { span: someCodeSpan },
                        ),
                    },
                ],
            }),
        )

        for (const isolationLevel of cases) {
            test(isolationLevel, () => {
                context.scope.addVariableDeclaration('myVar', {
                    isImmutable: true,
                    isolationLevel,
                    lattice: RCTypeLattice.create({
                        type: TypeName.create({ name: 'MyType' }),
                    }),
                })

                const variableRef = VariableReference.create({
                    name: 'myVar',
                    span: someCodeSpan,
                })
                const result = variableRef.isolationLevel(context)
                expect(result.isSuccess && result.value).toEqual(isolationLevel)
            })
        }
    })
})
