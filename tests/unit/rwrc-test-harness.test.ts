import { describe, expect, it } from 'bun:test'
import { Parser } from '../../src/parser'
import { TokenStream } from '../../src/lexer'
import {
    assertUniqueTestFunctionNames,
    extractRunnableTestsFromAst,
    finalizeDiscoveredTests,
    generateHarnessSource,
} from '../../src/rwrc/test-harness'
import { NewFilePath } from '../../src/filesystem'

function parse(code: string) {
    return new Parser(new TokenStream(code, 't.clawr')).parse()
}

describe('rwrc test harness', () => {
    it('extracts @Test void functions with no parameters', () => {
        const ast = parse(`
            @Test func a() {}
            func skip() {}
            @Test func b() {}
        `)
        const { accepted, skipped } = extractRunnableTestsFromAst(
            ast,
            '/x/y.clawr',
        )
        expect(skipped).toEqual([])
        expect(accepted.map((t) => t.functionName).sort()).toEqual(['a', 'b'])
    })

    it('skips @Test with parameters or return type', () => {
        const ast = parse(`
            @Test func badArgs(x: integer) {}
            @Test func badRet() -> integer { return 1 }
            @Test func ok() {}
        `)
        const { accepted, skipped } = extractRunnableTestsFromAst(
            ast,
            '/m.clawr',
        )
        expect(accepted.map((t) => t.functionName)).toEqual(['ok'])
        expect(skipped.map((s) => s.reason).sort()).toEqual([
            'has_parameters',
            'non_void_signature',
        ])
    })

    it('ignores helper and non-annotated functions', () => {
        const ast = parse(`
            helper func h() {}
            @Test func t() {}
        `)
        const { accepted } = extractRunnableTestsFromAst(ast, '/z.clawr')
        expect(accepted.map((t) => t.functionName)).toEqual(['t'])
    })

    it('rejects duplicate test names across files', () => {
        const raw = [
            { absolutePath: '/proj/a.clawr', functionName: 'same' },
            { absolutePath: '/proj/b.clawr', functionName: 'same' },
        ]
        expect(() => assertUniqueTestFunctionNames(raw)).toThrow(
            /duplicate @Test function name 'same'/,
        )
    })

    it('finalizeDiscoveredTests passes when names are unique', () => {
        const raw = [
            { absolutePath: '/p/a.clawr', functionName: 'a' },
            { absolutePath: '/p/b.clawr', functionName: 'b' },
        ]
        expect(finalizeDiscoveredTests(raw)).toEqual([
            { absolutePath: '/p/a.clawr', functionName: 'a' },
            { absolutePath: '/p/b.clawr', functionName: 'b' },
        ])
    })

    it('generates harness with calls to test functions', () => {
        const harness = NewFilePath.resolve('/tmp/harness')
        const tests = [
            {
                absolutePath: '/tmp/tests/t.clawr',
                functionName: 'foo',
            },
        ]
        const src = generateHarnessSource(harness, tests)
        expect(src).toContain('foo()')
    })
})
