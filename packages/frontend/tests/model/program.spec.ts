import { Scope } from '@/model/scope'
import { parseProgram } from '@/program'
import { createStandardLibraryScope } from '@/stdlib'
import { SourceError, SourceErrorCollection } from '@/tools'
import { describe, expect, it } from 'bun:test'

function compile(sources: { name: string; source: string }[]) {
    const scope = Scope.createRoot(createStandardLibraryScope())
    return parseProgram(sources, scope).toCIR({ scope })
}

describe('multi-file programs', () => {
    it('resolves functions declared in another file in either order', () => {
        const first = {
            name: 'first.clawr',
            source: 'func first() => second() @main { print(first()) }',
        }
        const second = { name: 'second.clawr', source: 'func second() => 42' }
        expect(compile([first, second]).declarations).toHaveLength(2)
        expect(compile([second, first]).declarations).toHaveLength(2)
    })

    it('requires exactly one main, including empty blocks', () => {
        expect(() => compile([{ name: 'a', source: 'func f() => 1' }])).toThrow(
            'No @main',
        )
        expect(() =>
            compile([
                { name: 'a', source: '@main {}' },
                { name: 'b', source: '@main {}' },
            ]),
        ).toThrow('Multiple @main')
    })

    it('reports the source of a semantic error in another file', () => {
        try {
            compile([
                { name: 'a', source: '@main {}' },
                { name: 'b', source: 'func f() { missing() }' },
            ])
            throw new Error('Expected an error')
        } catch (error) {
            expect(error).toBeInstanceOf(SourceErrorCollection)
            expect(
                (error as SourceErrorCollection).errors[0].span.start.source,
            ).toBe('b')
        }
    })

    it('rejects duplicate functions while permitting overloads', () => {
        const main = { name: 'a', source: 'func f() => 1 @main {}' }
        expect(() =>
            compile([main, { name: 'b', source: 'func f() => 2' }]),
        ).toThrow('Duplicate declaration')
        expect(() =>
            compile([main, { name: 'b', source: 'func f(_ x: integer) => x' }]),
        ).not.toThrow()
    })

    it('reports duplicate entry points at the second source', () => {
        try {
            compile([
                { name: 'a', source: '@main {}' },
                { name: 'b', source: '@main {}' },
            ])
            throw new Error('Expected an error')
        } catch (error) {
            expect(error).toBeInstanceOf(SourceError)
            expect((error as SourceError).span.start.source).toBe('b')
        }
    })

    it('resolves named aliases only after their declaration', () => {
        const definition = {
            name: 'types',
            source: 'subset Count = integer(0...10)',
        }
        const use = {
            name: 'main',
            source: '@main { const value: Count = 2 print(value) }',
        }
        expect(() => compile([definition, use])).not.toThrow()
        expect(() => compile([use, definition])).toThrow()
    })
})
