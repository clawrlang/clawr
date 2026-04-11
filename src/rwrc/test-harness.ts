import fs from 'node:fs'
import path from 'node:path'
import { glob } from 'fast-glob'
import type { ASTProgram } from '../ast'
import { TokenStream } from '../lexer'
import { Parser } from '../parser'

/** One runnable @Test; call sites must use `functionName` (merged program keeps declaration names). */
export interface DiscoveredTest {
    readonly absolutePath: string
    readonly functionName: string
}

export type DiscoverySkipReason = 'non_void_signature' | 'has_parameters'

export interface DiscoverySkip {
    readonly file: string
    readonly functionName: string
    readonly reason: DiscoverySkipReason
}

export interface RawDiscoveredTest {
    readonly absolutePath: string
    readonly functionName: string
}

export function extractRunnableTestsFromAst(
    ast: ASTProgram,
    absolutePath: string,
): { accepted: RawDiscoveredTest[]; skipped: DiscoverySkip[] } {
    const accepted: RawDiscoveredTest[] = []
    const skipped: DiscoverySkip[] = []
    const fileLabel = absolutePath

    for (const stmt of ast.body) {
        if (stmt.kind !== 'func-decl') continue
        if (stmt.visibility === 'helper') continue
        if (!stmt.annotations?.some((a) => a.name === 'Test')) continue

        if (stmt.parameters.length > 0) {
            skipped.push({
                file: fileLabel,
                functionName: stmt.name,
                reason: 'has_parameters',
            })
            continue
        }
        if (stmt.returnType !== undefined) {
            skipped.push({
                file: fileLabel,
                functionName: stmt.name,
                reason: 'non_void_signature',
            })
            continue
        }

        accepted.push({ absolutePath, functionName: stmt.name })
    }

    return { accepted, skipped }
}

export function assertUniqueTestFunctionNames(
    accepted: RawDiscoveredTest[],
): void {
    const seen = new Map<string, string>()
    for (const t of accepted) {
        const prev = seen.get(t.functionName)
        if (prev !== undefined) {
            throw new Error(
                `rwrc test: duplicate @Test function name '${t.functionName}' (${prev} and ${t.absolutePath}); merged compilation requires unique top-level function names`,
            )
        }
        seen.set(t.functionName, t.absolutePath)
    }
}

export function finalizeDiscoveredTests(
    accepted: RawDiscoveredTest[],
): DiscoveredTest[] {
    assertUniqueTestFunctionNames(accepted)
    return accepted.map((r) => ({
        absolutePath: r.absolutePath,
        functionName: r.functionName,
    }))
}

function skipReasonMessage(reason: DiscoverySkipReason): string {
    switch (reason) {
        case 'has_parameters':
            return 'must have no parameters'
        case 'non_void_signature':
            return 'must be void (no return type)'
    }
}

export function formatDiscoverySkipWarning(skip: DiscoverySkip): string {
    const why = skipReasonMessage(skip.reason)
    return `rwrc test: skipping @Test '${skip.functionName}' in ${skip.file}: ${why}`
}

export async function discoverTestsInTree(
    testRoot: string,
): Promise<{ tests: DiscoveredTest[]; skipped: DiscoverySkip[] }> {
    const root = path.resolve(testRoot)
    const files = await glob('**/*.clawr', {
        cwd: root,
        absolute: true,
        onlyFiles: true,
    })
    files.sort()

    const rawAccepted: RawDiscoveredTest[] = []
    const skipped: DiscoverySkip[] = []

    for (const file of files) {
        const source = await fs.promises.readFile(file, 'utf-8')
        const ast = new Parser(
            new TokenStream(source, path.basename(file)),
        ).parse()
        const { accepted, skipped: fileSkipped } = extractRunnableTestsFromAst(
            ast,
            file,
        )
        rawAccepted.push(...accepted)
        skipped.push(...fileSkipped)
    }

    const tests = finalizeDiscoveredTests(rawAccepted)
    return { tests, skipped }
}

export function generateHarnessSource(
    harnessAbsolutePath: string,
    tests: DiscoveredTest[],
): string {
    if (tests.length === 0) {
        return ''
    }

    const harnessDir = path.dirname(harnessAbsolutePath)
    const byModule = new Map<string, string[]>()

    for (const t of tests) {
        const rel = path.relative(harnessDir, t.absolutePath).replace(
            /\\/g,
            '/',
        )
        if (!byModule.has(rel)) {
            byModule.set(rel, [])
        }
        byModule.get(rel)!.push(t.functionName)
    }

    const importLines: string[] = []
    const sortedMods = [...byModule.keys()].sort()
    for (const mod of sortedMods) {
        const names = [...new Set(byModule.get(mod)!)].sort()
        importLines.push(`import ${names.join(', ')} from "${mod}"`)
    }

    const ordered = [...tests].sort((a, b) => {
        const pa = a.absolutePath.localeCompare(b.absolutePath)
        if (pa !== 0) return pa
        return a.functionName.localeCompare(b.functionName)
    })
    const calls = ordered.map((t) => `${t.functionName}()`).join('\n')
    return `${importLines.join('\n')}\n\n${calls}\n`
}
