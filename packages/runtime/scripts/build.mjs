// Builds the runtime dylib. The compatibility version is defined only in
// package.json (`clawr.compatibilityVersion`); the package `version` is the current version.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'))
const compat = pkg.clawr.compatibilityVersion
const libName = `libClawr.${compat.split('.')[0]}.dylib`

fs.rmSync('dist', { recursive: true, force: true })
fs.mkdirSync('dist', { recursive: true })
fs.cpSync('src/include', 'dist/include', { recursive: true })

const sources = fs
    .readdirSync('src')
    .filter((f) => f.endsWith('.c'))
    .map((f) => `src/${f}`)
execFileSync(
    'clang',
    [
        '-I', 'dist/include',
        ...sources,
        '-dynamiclib',
        '-fvisibility=hidden',
        '-current_version', pkg.version,
        '-compatibility_version', compat,
        `-Wl,-install_name,@rpath/${libName}`,
        '-o', `dist/${libName}`,
    ],
    { stdio: 'inherit' },
)
// Consumers read this to locate the library without hard-coding its name.
fs.writeFileSync('dist/libClawr.name', libName)
execFileSync('otool', ['-L', `dist/${libName}`], { stdio: 'inherit' })
