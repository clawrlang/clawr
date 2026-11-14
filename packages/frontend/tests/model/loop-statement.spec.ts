import { TokenStream } from '@/lexer'
import { Scope } from '@/model/scope'
import { ModuleParser } from '@/parser/module-parser'
import { describe, expect, it } from 'bun:test'

function compile(source: string) {
    const scope = Scope.createRoot()
    const module = ModuleParser.create({}).parse(TokenStream.read(source))
    return { cir: module.toCIR({ scope }), scope }
}

describe('loop semantics', () => {
    it('emits pre-test and post-test loops', () => {
        const { cir } = compile(
            '@main { while false {} repeat {} while ambiguous }',
        )
        expect(cir.startBlock).toMatchObject([
            { kind: 'LOOP', testAfter: false, body: [] },
            { kind: 'LOOP', testAfter: true, body: [] },
        ])
    })

    it('rejects non-truthvalue conditions and inaccessible body locals', () => {
        expect(() => compile('@main { while 1 {} }')).toThrow(
            'Loop condition requires a truthvalue',
        )
        expect(() => compile('@main { repeat {} while 1 }')).toThrow(
            'Loop condition requires a truthvalue',
        )
        expect(() =>
            compile('@main { repeat { const local = true } while local }'),
        ).toThrow('local')
        expect(() =>
            compile(
                '@main { while false { const local = true } const x = local }',
            ),
        ).toThrow('local')
    })

    it('widens outer values in the body and after nested loop assignments', () => {
        const { scope } = compile(
            '@main { mut value: truthvalue = true while value { if value { value = false } } }',
        )
        expect(scope.currentValue('value')).toMatchObject({
            values: ['false', 'ambiguous', 'true'],
        })
    })

    it('does not narrow from a value assigned only after the loop starts', () => {
        expect(() =>
            compile(`
                @main {
                    mut value: integer = 0
                    while value < 3 {
                        const limited: integer (0...1) = value
                        value = value + 1
                    }
                }
            `),
        ).toThrow()
    })
})
