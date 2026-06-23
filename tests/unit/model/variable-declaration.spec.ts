import { describe, expect, it } from 'bun:test'
import { IntegerLiteral, VariableDeclaration } from '../../../src/model'
import { TestErrorReporter } from '../../util'

describe('VariableDeclaration', () => {
    it('converts to CIR VARIABLE_DECL', () => {
        const decl = VariableDeclaration.create({
            semantics: 'const',
            name: 'foo',
            type: 'integer',
            initialValue: IntegerLiteral.create(1n),
        })
        expect(decl.toCIR(emptyContext)).toEqual({
            kind: 'VARIABLE_DECL',
            name: 'foo',
            type: 'integer',
            initialValue: { kind: 'INTEGER_LITERAL', value: '1' },
        })
    })
})

const emptyContext = {
    variableTypes: new Map(),
    errorReporter: new TestErrorReporter('test.clawr'),
}
