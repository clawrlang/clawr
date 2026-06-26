import { describe, expect, it, test } from 'bun:test'
import { Assignment } from '../../../src/model/assignment'
import { newSemanticContext, someCodeSpan } from '../../util'
import { VariableReference } from '../../../src/model/variable-reference'
import { IntegerLiteral } from '../../../src/model/integer-literal'

describe('Assignment', () => {
    it('outputs the correct CIR representation', () => {
        const context = newSemanticContext()
        context.scope.variables.set('x', { semantics: 'mut', type: 'integer' })

        const assignment = Assignment.create({
            target: VariableReference.create({ name: 'x', span: someCodeSpan }),
            value: IntegerLiteral.create(42n),
        })

        expect(assignment.toCIR(context)).toMatchObject({
            kind: 'ASSIGN',
            target: { kind: 'VARIABLE_REF', name: 'x' },
            value: { kind: 'INTEGER_LITERAL', value: '42' },
        })
    })

    it('throws if the target variable is not in context', () => {
        const assignment = Assignment.create({
            target: VariableReference.create({ name: 'x', span: someCodeSpan }),
            value: IntegerLiteral.create(42n),
        })
        expect(() => assignment.toCIR(newSemanticContext())).toThrow()
    })

    describe('throws if the target variable is immutable/non-assignable', () => {
        for (const kind of ['const', 'ref'] as const) {
            test(kind, () => {
                const context = newSemanticContext()
                context.scope.variables.set('x', {
                    semantics: kind,
                    type: 'integer',
                })

                const assignment = Assignment.create({
                    target: VariableReference.create({
                        name: 'x',
                        span: someCodeSpan,
                    }),
                    value: IntegerLiteral.create(42n),
                })
                expect(() => assignment.toCIR(context)).toThrow()
            })
        }
    })
})
