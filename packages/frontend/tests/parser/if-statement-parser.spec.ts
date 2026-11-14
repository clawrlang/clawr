import { TokenStream } from '@/lexer'
import { ModuleParser } from '@/parser/module-parser'
import { describe, expect, it } from 'bun:test'

describe('if statement parsing', () => {
    const parse = (source: string) =>
        ModuleParser.create({}).parse(TokenStream.read(`@main { ${source} }`))

    it('parses nested branches, else if, and unary negation', () => {
        expect(
            parse('if true { if !false {} } else if ambiguous {} else {}'),
        ).toMatchObject({
            main: [
                {
                    then: [{ condition: { operand: {} }, then: [] }],
                    otherwise: [{ then: [], otherwise: [] }],
                },
            ],
        })
    })

    it('requires a condition and brace-delimited bodies', () => {
        expect(() => parse('if true return')).toThrow()
        expect(() => parse('if {}')).toThrow()
        expect(() => parse('if true {} else return')).toThrow()
        expect(() => parse('if true {')).toThrow()
    })

    it('parses the banking example conditional shape', () => {
        expect(parse('if remaining != 0 { remaining = 1 }')).toMatchObject({
            main: [
                { condition: {}, then: [{ target: { name: 'remaining' } }] },
            ],
        })
    })
})
