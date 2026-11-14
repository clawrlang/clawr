import { TokenStream } from '@/lexer'
import { ModuleParser } from '@/parser/module-parser'
import { describe, expect, it } from 'bun:test'

describe('loop statement parsing', () => {
    const parse = (source: string) =>
        ModuleParser.create({}).parse(TokenStream.read(`@main { ${source} }`))

    it('parses nested while and repeat loops', () => {
        expect(parse('while true { repeat {} while false }')).toMatchObject({
            main: [{ testAfter: false, body: [{ testAfter: true }] }],
        })
    })

    it('requires conditions, braces, and the trailing while', () => {
        for (const source of [
            'while true return',
            'while {}',
            'while true {',
            'repeat {}',
            'repeat {} while',
            'repeat return while true',
        ])
            expect(() => parse(source)).toThrow()
    })
})
