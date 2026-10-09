import { TokenStream } from '@/lexer'
import { SelfAssignment } from '@/model/self-assignment'
import { AssignmentParser } from '@/parser/assignment-parser'
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

    it('parses an assignment with a property lookup', () => {
        const code = 'obj.property = true'
        const result = parseAssignment(code)
        expect(result).toMatchObject({
            target: {
                object: { name: 'obj' },
                property: 'property',
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
                properties: [
                    { name: 'c', value: { value: { min: 12n, max: 12n } } },
                ],
            },
        })
    })
})

function parseAssignment(input: string) {
    const stream = TokenStream.read(input)
    return AssignmentParser.create({}).parse(stream)
}
