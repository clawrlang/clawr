import { Context } from '@/model'
import { DataDeclaration } from '@/model/data-declaration'
import { IntegerLiteral } from '@/model/integer-literal'
import { ISOLATED, SHARED } from '@/model/isolation-level'
import { ReturnStatement } from '@/model/return-statement'
import { TypeName } from '@/model/type-name'
import { IntegerRange, RCTypeSet, TruthvalueSet } from '@/model/value-set'
import { VariableReference } from '@/model/variable-reference'
import { newSemanticContext, someCodeSpan } from '@@/util'
import { describe, expect, it } from 'bun:test'

describe('ReturnStatement', () => {
    it('converts to CIR', () => {
        const returnStatement = ReturnStatement.create({
            value: IntegerLiteral.create({ value: 42n, span: someCodeSpan }),
            span: someCodeSpan,
        })

        const context: Context = {
            ...newSemanticContext(),
            calleeResult: {
                domain: IntegerRange.unconstrained(),
                isolationLevel: ISOLATED,
            },
        }
        returnStatement.emitStatement(context)

        expect(context.scope.emitted[0]).toMatchObject({
            kind: 'RETURN',
            value: { value: { max: '42', min: '42' } },
        })
    })

    it('disallows value for void functions', () => {
        const returnStatement = ReturnStatement.create({
            value: IntegerLiteral.create({ value: 42n, span: someCodeSpan }),
            span: someCodeSpan,
        })

        const context = newSemanticContext()
        const result = returnStatement.emitStatement(context)
        expect(result.isError).toBeTrue()
        expect(context.scope.emitted.length).toBe(0)
    })

    it('disallows value with incompatible type', () => {
        const returnStatement = ReturnStatement.create({
            value: IntegerLiteral.create({ value: 42n, span: someCodeSpan }),
            span: someCodeSpan,
        })

        const context: Context = {
            ...newSemanticContext(),
            calleeResult: {
                domain: TruthvalueSet.unconstrained(),
                isolationLevel: ISOLATED,
            },
        }
        const result = returnStatement.emitStatement(context)
        expect(result.isError).toBeTrue()
        expect(context.scope.emitted.length).toBe(0)
    })

    it('disallows value with wrong isolation-level', () => {
        const context = newSemanticContext()
        context.scope.rootScope.addDataDeclaration(
            DataDeclaration.create({
                name: TypeName.create({ name: 'MyData' }),
                fields: [],
            }),
        )
        context.scope.addVariableDeclaration('x', {
            isImmutable: true,
            isolationLevel: ISOLATED,
            domain: RCTypeSet.create({
                type: TypeName.create({ name: 'MyData' }),
            }),
        })
        const returnStatement = ReturnStatement.create({
            value: VariableReference.create({ name: 'x', span: someCodeSpan }),
            span: someCodeSpan,
        })

        const result = returnStatement.emitStatement({
            ...context,
            calleeResult: {
                domain: RCTypeSet.create({
                    type: TypeName.create({ name: 'MyData' }),
                }),
                isolationLevel: SHARED,
            },
        })
        expect(
            result.isError && result.error.errors.map((e) => e.message),
        ).toContain('Cannot return an ISOLATED value as SHARED')
        expect(context.scope.emitted.length).toBe(0)
    })
})
