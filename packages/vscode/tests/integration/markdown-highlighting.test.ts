import * as assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import * as vscode from 'vscode'
import * as oniguruma from 'vscode-oniguruma'
import * as textmate from 'vscode-textmate'

suite('Markdown Clawr highlighting', () => {
    test('highlights only Clawr fenced blocks using the Markdown grammar', async () => {
        const extensionRoot = resolve(__dirname, '../..')
        const manifest = JSON.parse(
            readFileSync(join(extensionRoot, 'package.json'), 'utf8'),
        )
        const injection = manifest.contributes.grammars.find(
            (grammar: { scopeName: string }) =>
                grammar.scopeName === 'markdown.clawr.codeblock',
        )
        assert.ok(injection.injectTo.includes('text.html.markdown'))
        assert.strictEqual(
            injection.embeddedLanguages['meta.embedded.block.clawr'],
            'clawr',
        )

        const wasm = readFileSync(
            require.resolve('vscode-oniguruma/release/onig.wasm'),
        )
        await oniguruma.loadWASM(
            wasm.buffer.slice(
                wasm.byteOffset,
                wasm.byteOffset + wasm.byteLength,
            ),
        )
        const files: Record<string, string> = {
            'text.html.markdown': join(
                vscode.env.appRoot,
                'extensions/markdown-basics/syntaxes/markdown.tmLanguage.json',
            ),
            'source.clawr': join(
                extensionRoot,
                'syntaxes/clawr.tmLanguage.json',
            ),
            'markdown.clawr.codeblock': join(extensionRoot, injection.path),
        }
        const registry = new textmate.Registry({
            onigLib: Promise.resolve({
                createOnigScanner: (patterns) =>
                    new oniguruma.OnigScanner(patterns),
                createOnigString: (value) => new oniguruma.OnigString(value),
            }),
            loadGrammar: async (scope) => {
                const file = files[scope]
                return file
                    ? textmate.parseRawGrammar(readFileSync(file, 'utf8'), file)
                    : null
            },
            getInjections: (scope) =>
                injection.injectTo.includes(scope) ? [injection.scopeName] : [],
        })
        const grammar = await registry.loadGrammarWithConfiguration(
            'text.html.markdown',
            1,
            { embeddedLanguages: { 'meta.embedded.block.clawr': 2 } },
        )
        assert.ok(grammar)

        const lines = [
            '# Test',
            '```clawr',
            'object MyObject {',
            '  func value() => self->value',
            '}',
            '```',
            'object outside',
            '~~~CLAWr extra',
            'mut count: integer = 0',
            '~~~',
            '```clawrish',
            'object Other',
            '```',
            '```text',
            '```clawr',
            'object NotNested',
            '```',
            '````clawr',
            'object LongerFence',
            '`````',
            'object AfterLongerFence',
            '~~~clawr',
            'object LongerTilde',
            '~~~~',
            'object AfterLongerTilde',
        ]
        let state: textmate.StackElement | null = null
        const scopes: string[][][] = []
        const languageIds: number[][] = []
        for (const line of lines) {
            const result = grammar.tokenizeLine(line, state)
            const encoded = grammar.tokenizeLine2(line, state)
            scopes.push(result.tokens.map((token) => token.scopes))
            languageIds.push(
                Array.from(encoded.tokens)
                    .filter((_, index) => index % 2 === 1)
                    .map((metadata) => metadata & 0xff),
            )
            state = result.ruleStack
        }
        const hasScope = (index: number, scope: string) =>
            scopes[index].some((token) => token.includes(scope))
        assert.ok(hasScope(2, 'keyword.other.declaration.clawr'))
        assert.ok(hasScope(3, 'keyword.other.declaration.clawr'))
        assert.ok(hasScope(8, 'storage.modifier.clawr'))
        assert.ok(hasScope(18, 'keyword.other.declaration.clawr'))
        assert.ok(hasScope(22, 'keyword.other.declaration.clawr'))
        assert.ok(hasScope(2, 'meta.embedded.block.clawr'))
        assert.ok(languageIds[2].includes(2))
        for (const index of [
            0, 1, 5, 6, 10, 11, 12, 14, 15, 16, 19, 20, 23, 24,
        ])
            assert.ok(
                !hasScope(index, 'meta.embedded.block.clawr'),
                `line ${index}`,
            )
    })
})
