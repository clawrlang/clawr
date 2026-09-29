import { DataDeclaration } from '@/model/data-declaration'
import { ISOLATED, SHARED } from '@/model/isolation-level'
import { IntegerRange, RCTypeSet } from '@/model/value-set'
import { VariableReference } from '@/model/variable-reference'
import * as util from '@@/util'
import { describe, expect, it, test } from 'bun:test'

describe('Variable Reference', () => {
    it('generates correct CIR', () => {
        const context = util.newSemanticContext()
        context.scope.addVariableDeclaration('myVar', {
            isImmutable: true,
            isolationLevel: ISOLATED,
            domain: IntegerRange.create({ min: 10n, max: 10n }),
        })

        const variableRef = util.variableRef('myVar')
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

        const context = util.newSemanticContext()
        const result = variableRef.toCIRExpression(context)
        expect(result.isError && result.error.errors[0]).toMatchObject({
            message: `Variable myVar is not defined in the current context`,
            span,
        })
    })

    it('infers its type from the context', () => {
        const context = util.newSemanticContext()
        context.scope.addVariableDeclaration('myVar', {
            isImmutable: true,
            isolationLevel: ISOLATED,
            domain: IntegerRange.create({ min: 10n, max: 10n }),
        })

        const variableRef = util.variableRef('myVar')
        const result = variableRef.domain(context)
        expect(result.isSuccess && result.value).toEqual(
            IntegerRange.create({ min: 10n, max: 10n }),
        )
    })

    it('has the same current value as the referenced variable', () => {
        const context = util.newSemanticContext()
        context.scope.addVariableDeclaration('myVar', {
            isImmutable: true,
            isolationLevel: ISOLATED,
            domain: IntegerRange.create({ min: 10n, max: 10n }),
        })

        const variableRef = util.variableRef('myVar')
        const result = variableRef.currentValue(context)
        expect(result.isSuccess && result.value).toMatchObject({
            min: 10n,
            max: 10n,
        })
    })

    describe('infers isolation level from the context', () => {
        const cases = [ISOLATED, SHARED] as const

        const context = util.newSemanticContext()
        context.scope.rootScope.addDataDeclaration(
            DataDeclaration.create({
                name: util.simpleTypeName('MyType'),
                fields: [{ ...util.someFieldDeclConfig, name: 'myField' }],
            }),
        )

        for (const isolationLevel of cases) {
            test(isolationLevel, () => {
                context.scope.addVariableDeclaration('myVar', {
                    isImmutable: true,
                    isolationLevel,
                    domain: RCTypeSet.create({
                        type: util.simpleTypeName('MyType'),
                    }),
                })

                const variableRef = util.variableRef('myVar')
                const result = variableRef.isolationLevel(context)
                expect(result.isSuccess && result.value).toEqual(isolationLevel)
            })
        }
    })
})
