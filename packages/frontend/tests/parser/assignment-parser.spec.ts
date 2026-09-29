import { TokenStream } from '@/lexer'
import { SelfAssignment } from '@/model/self-assignment'
import { AssignmentParser } from '@/parser/assignment-parser'
import { TestErrorReporter } from '@@/util'
import { describe, expect, it } from 'bun:test'

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

    it('parses a self-assignment', () => {
        const code = 'self = {c: 12}'
        const result = parseAssignment(code)
        expect(result).toBeInstanceOf(SelfAssignment)
        expect(result).toMatchObject({
            value: {
                fields: [
                    { name: 'c', value: { value: { min: 12n, max: 12n } } },
                ],
            },
        })
    })
})

function parseAssignment(input: string) {
    const errorReporter = new TestErrorReporter()
    const stream = TokenStream.read(input, errorReporter)
    return AssignmentParser.create({ errorReporter }).parse(stream)
}
