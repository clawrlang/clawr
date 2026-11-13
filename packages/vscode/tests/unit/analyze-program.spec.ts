import { describe, expect, it } from 'bun:test'
import { analyzeProgram } from '../../src/analyze-program'

describe('workspace program analysis', () => {
    it('accepts a string property returned with an explicit result type', () => {
        const name = 'file:///email.clawr'
        const results = analyzeProgram([
            {
                name,
                source: 'object EmailAddress { func value() -> string => self->value state: const value: string }',
            },
        ])
        expect(results.get(name)!.diagnostics).toHaveLength(0)
    })

    it('resolves cross-file functions and types to their definitions', () => {
        const results = analyzeProgram([
            {
                name: 'file:///a.clawr',
                source: 'func show(_ value: Thing) { print(number()) } @main {}',
            },
            {
                name: 'file:///b.clawr',
                source: 'data Thing {} func number() => 42',
            },
        ])
        const a = results.get('file:///a.clawr')!
        expect(a.diagnostics).toHaveLength(0)
        expect(
            a.definitions.map((item) => item.definition.start.source),
        ).toEqual(['file:///b.clawr', 'file:///b.clawr'])
    })

    it('attributes semantic errors to their own file', () => {
        const results = analyzeProgram([
            { name: 'file:///a.clawr', source: '@main {}' },
            { name: 'file:///b.clawr', source: 'func broken() { missing() }' },
        ])
        expect(results.get('file:///a.clawr')!.diagnostics).toHaveLength(0)
        expect(
            results.get('file:///b.clawr')!.diagnostics[0].message,
        ).toContain('missing')
    })

    it('continues analyzing other files after a parse error', () => {
        const results = analyzeProgram([
            { name: 'file:///bad.clawr', source: '@main { const x = ' },
            { name: 'file:///good.clawr', source: 'func number() => 42' },
            { name: 'file:///use.clawr', source: '@main { print(number()) }' },
        ])
        expect(results.get('file:///bad.clawr')!.diagnostics).toHaveLength(1)
        expect(
            results.get('file:///use.clawr')!.definitions[0].definition.start
                .source,
        ).toBe('file:///good.clawr')
    })

    it('resolves overloads by their labels and local declarations before stdlib', () => {
        const results = analyzeProgram([
            {
                name: 'file:///main.clawr',
                source: '@main { print(pick(1)) print(pick(value: 2)) } func print(_ x: integer) {}',
            },
            {
                name: 'file:///first.clawr',
                source: 'func pick(_ x: integer) => x',
            },
            {
                name: 'file:///second.clawr',
                source: 'func pick(value: integer) => value',
            },
        ])
        const main = results.get('file:///main.clawr')!
        expect(main.diagnostics).toHaveLength(0)
        const targets = main.definitions.map(
            (item) => item.definition.start.source,
        )
        expect(targets).toContain('file:///main.clawr')
        expect(targets).toContain('file:///first.clawr')
        expect(targets).toContain('file:///second.clawr')
    })
})
