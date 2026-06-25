import { describe, expect, it } from 'bun:test'
import { Assignment } from '../../../src/model/assignment'
import { newSemanticContext } from '../../util'
import { VariableReference } from '../../../src/model/variable-reference'
import { IntegerLiteral } from '../../../src/model/integer-literal'

describe('Assignment', () => {
    it('outputs the correct CIR representation', () => {
        const assignment = Assignment.create({
            target: VariableReference.create('x'),
            value: IntegerLiteral.create(42n),
        })
        const cir = assignment.toCIR(newSemanticContext())

        expect(cir).toMatchObject({
            kind: 'ASSIGN',
            target: { kind: 'VARIABLE_REF', name: 'x' },
            value: { kind: 'INTEGER_LITERAL', value: '42' },
        })
    })
})
