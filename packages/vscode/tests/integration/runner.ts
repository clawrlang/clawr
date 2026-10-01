// Minimal Mocha-TDD-compatible test harness so integration tests can run
// inside the VS Code extension host without depending on mocha/@vscode/test-cli.
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

declare global {
    function suite(name: string, fn: () => void): void
    function test(name: string, fn: () => void | Promise<void>): void
}

interface TestCase {
    name: string
    fn: () => void | Promise<void>
}

interface Suite {
    name: string
    tests: TestCase[]
}

const suites: Suite[] = []
let currentSuite: Suite | undefined

function suite(name: string, fn: () => void): void {
    const parent = currentSuite
    const s: Suite = {
        name: parent ? `${parent.name} > ${name}` : name,
        tests: [],
    }
    suites.push(s)
    currentSuite = s
    try {
        fn()
    } finally {
        currentSuite = parent
    }
}

function test(name: string, fn: () => void | Promise<void>): void {
    if (!currentSuite)
        throw new Error(`test("${name}") called outside of a suite`)
    currentSuite.tests.push({ name, fn })
}

globalThis.suite = suite
globalThis.test = test

function findTestFiles(dir: string): string[] {
    const files: string[] = []
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const fullPath = join(dir, entry.name)
        if (entry.isDirectory()) files.push(...findTestFiles(fullPath))
        else if (entry.isFile() && entry.name.endsWith('.test.js'))
            files.push(fullPath)
    }
    return files
}

export async function run(): Promise<void> {
    for (const file of findTestFiles(__dirname)) require(file)

    let passed = 0
    const failures: string[] = []

    for (const s of suites) {
        for (const t of s.tests) {
            const label = `${s.name} > ${t.name}`
            try {
                await t.fn()
                passed++
                console.log(`  \u2713 ${label}`)
            } catch (error) {
                failures.push(label)
                console.error(`  \u2717 ${label}`)
                console.error(error)
            }
        }
    }

    console.log(`\n${passed} passing, ${failures.length} failing`)

    if (failures.length > 0)
        throw new Error(
            `${failures.length} integration test(s) failed:\n${failures.join('\n')}`,
        )
}
