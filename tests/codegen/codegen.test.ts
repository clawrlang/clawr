import fs from 'fs'
import path from 'path'
import child_process from 'node:child_process'
import { describe, expect, it } from 'bun:test'
import { glob } from 'fast-glob'
import { codegenC } from '../../src/codegen'
import { CModule } from '../../src/ir'

const OUTPUT_DIR = path.join(__dirname, 'out')
const RUNTIME_DIR = path.join(__dirname, '../../src/runtime')

describe('Codegen Tests', () => {
    it('emits correct C code for truthvalue variable declaration', async () => {
        const module: CModule = {
            body: [
                {
                    kind: 'var-decl',
                    type: 'truthvalue_t',
                    name: 'x',
                    value: { kind: 'var-ref', name: 'c_ambiguous' },
                },
                {
                    kind: 'function-call',
                    name: 'printf',
                    arguments: [
                        { kind: 'string', value: '%s\\n' },
                        {
                            kind: 'function-call',
                            name: 'truthvalue·toCString',
                            arguments: [{ kind: 'var-ref', name: 'x' }],
                        },
                    ],
                },
            ],
        }

        const cCode = codegenC(module)
        const exeResult = await execute(cCode, 'test')
        expectOutput('ambiguous\n', exeResult)
    })
})

function expectOutput(expectedOutput: string, exeResult: ExecResult) {
    expect(exeResult.stdout).toBe(expectedOutput)
}

async function execute(code: string, testName: string) {
    const filePath = `${OUTPUT_DIR}/${testName}.c`
    const exePath = `${OUTPUT_DIR}/${testName}`

    await writeFile(filePath, code)

    const compilerResult = await runClang(filePath, exePath)
    expect(compilerResult.stdout).toBe('')
    expectSuccess(compilerResult)

    const exeResult = await exec(exePath, [])
    expectSuccess(exeResult)
    return exeResult
}

async function writeFile(filePath: string, content: string) {
    if (!fs.existsSync(path.dirname(filePath)))
        fs.mkdirSync(path.dirname(filePath), { recursive: true })
    await fs.promises.writeFile(filePath, content)
}

async function runClang(filePath: string, exeFile: string) {
    if (!fs.existsSync(path.dirname(exeFile)))
        fs.mkdirSync(path.dirname(exeFile), { recursive: true })
    return await exec('clang', [
        '-I',
        path.join(RUNTIME_DIR, 'include'),
        filePath,
        ...(await glob(path.join(RUNTIME_DIR, '*.c'))),
        '-o',
        exeFile,
    ])
}

async function exec(command: string, args: string[]) {
    return await new Promise<ExecResult>((resolve) => {
        const proc = child_process.spawn(command, args)

        let stdout = ''
        let stderr = ''

        proc.stdout!!.on('data', (data) => {
            stdout += data.toString()
        })

        proc.stderr!!.on('data', (data) => {
            stderr += data.toString()
        })

        proc.on('close', (x) => {
            resolve({
                code: x ?? -1,
                stderr,
                stdout,
            })
        })
    })
}

type ExecResult = {
    code: number
    stdout: string
    stderr: string
}

function expectSuccess(result: ExecResult) {
    expect(result).toMatchObject({
        code: 0,
        stderr: '',
    })
}
