import { readFileSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const directory = path.dirname(fileURLToPath(import.meta.url))
const sourceDirectory = path.resolve(
    directory,
    '../../vendor/clawr-doc/std-lib',
)
const manifestPath = path.join(sourceDirectory, 'manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
if (
    !manifest ||
    !Array.isArray(manifest.sources) ||
    manifest.sources.length === 0 ||
    manifest.sources.some(
        (name) =>
            typeof name !== 'string' ||
            !/^[a-zA-Z0-9._/-]+\.clawr$/.test(name) ||
            name
                .split('/')
                .some((part) => !part || part === '.' || part === '..'),
    ) ||
    new Set(manifest.sources).size !== manifest.sources.length
)
    throw new Error(`Invalid standard library manifest: ${manifestPath}`)

const root = realpathSync(sourceDirectory)
const sources = manifest.sources.map((name) => {
    const sourcePath = realpathSync(path.join(root, name))
    const relative = path.relative(root, sourcePath)
    if (
        relative === '..' ||
        relative.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relative)
    )
        throw new Error(
            `Standard library source is outside the source directory: ${name}`,
        )
    return { name, source: readFileSync(sourcePath, 'utf8') }
})
const outputDirectory = path.join(directory, 'dist')
mkdirSync(outputDirectory, { recursive: true })
writeFileSync(
    path.join(outputDirectory, 'index.js'),
    `exports.sources = ${JSON.stringify(sources, null, 2)}\n`,
)
writeFileSync(
    path.join(outputDirectory, 'index.d.ts'),
    'export declare const sources: readonly { readonly name: string; readonly source: string }[]\n',
)
