import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
    copyFileSync,
    mkdtempSync,
    mkdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const script = fileURLToPath(new URL('./build.mjs', import.meta.url))

function fixture(run) {
    const root = mkdtempSync(path.join(os.tmpdir(), 'clawr-stdlib-test-'))
    const packageDir = path.join(root, 'packages/stdlib')
    const sources = path.join(root, 'vendor/clawr-doc/spec/stdlib')
    mkdirSync(packageDir, { recursive: true })
    mkdirSync(sources, { recursive: true })
    copyFileSync(script, path.join(packageDir, 'build.mjs'))
    try {
        run({ packageDir, sources })
    } finally {
        rmSync(root, { recursive: true })
    }
}

function build(packageDir) {
    execFileSync(process.execPath, [path.join(packageDir, 'build.mjs')], {
        stdio: 'pipe',
    })
}

test('embeds exactly the ordered sources from the manifest', () =>
    fixture(({ packageDir, sources }) => {
        writeFileSync(
            path.join(sources, 'manifest.json'),
            JSON.stringify({ sources: ['b.clawr', 'nested/a.clawr'] }),
        )
        mkdirSync(path.join(sources, 'nested'))
        writeFileSync(path.join(sources, 'nested/a.clawr'), 'source A')
        writeFileSync(path.join(sources, 'b.clawr'), 'source B')
        build(packageDir)
        const bundle = createRequire(import.meta.url)(
            path.join(packageDir, 'dist/index.js'),
        )
        assert.deepEqual(bundle.sources, [
            { name: 'b.clawr', source: 'source B' },
            { name: 'nested/a.clawr', source: 'source A' },
        ])
        const first = readFileSync(
            path.join(packageDir, 'dist/index.js'),
            'utf8',
        )
        build(packageDir)
        assert.equal(
            readFileSync(path.join(packageDir, 'dist/index.js'), 'utf8'),
            first,
        )
    }))

test('rejects invalid manifests and missing source files', () =>
    fixture(({ packageDir, sources }) => {
        writeFileSync(
            path.join(sources, 'manifest.json'),
            JSON.stringify({ sources: ['../outside.clawr'] }),
        )
        assert.throws(
            () => build(packageDir),
            /Invalid standard library manifest/,
        )
        writeFileSync(
            path.join(sources, 'manifest.json'),
            JSON.stringify({ sources: ['missing.clawr'] }),
        )
        assert.throws(() => build(packageDir), /missing\.clawr/)
    }))
