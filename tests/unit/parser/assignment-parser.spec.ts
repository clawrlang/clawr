import { describe, expect, it } from 'bun:test'
import { TokenStream } from '../../../src/lexer'
import { TestErrorReporter } from '../../util'
import { AssignmentParser } from '../../../src/parser/assignment-parser'

describe('Assignment Parser', () => {
    it('parses a simple assignment', () => {
        const code = 'x = 42'
        const result = parseAssignment(code)
        expect(result).toMatchObject({
            target: { name: 'x' },
            value: { value: { max: 42n, min: 42n } },
        })
    })

    it('parses an assignment with a field lookup', () => {
        const code = 'obj.field = true'
        const result = parseAssignment(code)
        expect(result).toMatchObject({
            target: {
                object: { name: 'obj' },
                field: 'field',
            },
            value: { value: { values: ['true'] } },
        })
    })
})

function parseAssignment(input: string) {
    const errorReporter = new TestErrorReporter()
    const stream = TokenStream.read(input, errorReporter)
    return AssignmentParser.create({ errorReporter }).parse(stream)
}
