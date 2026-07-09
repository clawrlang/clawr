import { describe, it, expect } from 'bun:test'
import { ReturnStatement } from '../../../src/model/return-statement'
import { newSemanticContext, someCodeSpan } from '../../util'
import { IntegerLiteral } from '../../../src/model/integer-literal'

describe('ReturnStatement', () => {
    it('converts to CIR', () => {
        const returnStatement = ReturnStatement.create(
            IntegerLiteral.create({ value: 42n, span: someCodeSpan }),
        )

        const context = newSemanticContext()
        returnStatement.emitStatement(context)

        expect(context.scope.emitted[0]).toMatchObject({
            kind: 'RETURN',
            value: { value: '42' },
        })
    })
})
