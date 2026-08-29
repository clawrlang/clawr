import { describe, it, expect } from 'bun:test'
import { ReturnStatement } from '@/model/return-statement'
import { newSemanticContext, someCodeSpan } from '@@/util'
import { IntegerLiteral } from '@/model/integer-literal'
import { Context } from '@/model'
import {
    IntegerLattice,
    RCTypeLattice,
    TruthvalueLattice,
} from '@/model/lattice'
import { ISOLATED, SHARED } from '@/model/isolation-level'
import { TypeName } from '@/model/type-name'
import { DataDeclaration } from '@/model/data-declaration'
import { VariableReference } from '@/model/variable-reference'
import { Failable, isFailure } from '@/tools/failable'
import assert from 'assert'

describe('ReturnStatement', () => {
    it('converts to CIR', () => {
        const returnStatement = ReturnStatement.create({
            value: IntegerLiteral.create({ value: 42n, span: someCodeSpan }),
            span: someCodeSpan,
        })

        const context: Context = {
            ...newSemanticContext(),
            calleeResult: {
                lattice: IntegerLattice.unconstrained(),
                isolationLevel: ISOLATED,
            },
        }
        Failable.do(() => returnStatement.emitStatement(context))

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
        const result = Failable.do(() => returnStatement.emitStatement(context))
        expect(isFailure(result)).toBeTrue()
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
                lattice: TruthvalueLattice.unconstrained(),
                isolationLevel: ISOLATED,
            },
        }
        const result = Failable.do(() => returnStatement.emitStatement(context))
        expect(isFailure(result)).toBeTrue()
        expect(context.scope.emitted.length).toBe(1)
    })

    it('disallows value with wrong isolation-level', () => {
        const context = newSemanticContext()
        context.scope.rootScope.addDataDeclaration(
            DataDeclaration.create({
                name: TypeName.create({ name: 'MyData' }),
                fields: [],
            }),
        )
        context.scope.variables.set('x', {
            isImmutable: true,
            isolationLevel: ISOLATED,
            lattice: RCTypeLattice.create({
                type: TypeName.create({ name: 'MyData' }),
            }),
        })
        context.scope.setCurrentValue(
            'x',
            RCTypeLattice.create({ type: TypeName.create({ name: 'MyData' }) }),
        )
        const returnStatement = ReturnStatement.create({
            value: VariableReference.create({ name: 'x', span: someCodeSpan }),
            span: someCodeSpan,
        })

        const result = Failable.do(() =>
            returnStatement.emitStatement({
                ...context,
                calleeResult: {
                    lattice: RCTypeLattice.create({
                        type: TypeName.create({ name: 'MyData' }),
                    }),
                    isolationLevel: SHARED,
                },
            }),
        )
        assert(isFailure(result))
        expect(result.errors.map((e) => e.message)).toContain(
            'Cannot return an ISOLATED value as SHARED',
        )
        expect(context.scope.emitted.length).toBe(0)
    })
})
