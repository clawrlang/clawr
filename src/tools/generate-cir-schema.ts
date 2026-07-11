import fs from 'node:fs/promises'
import path from 'node:path'
import typia from 'typia'
import type { ClawrModule } from '../cir'

type JsonSchema = {
    [key: string]: unknown
}

function rewriteComponentRefs(node: unknown): unknown {
    if (Array.isArray(node)) {
        return node.map(rewriteComponentRefs)
    }
    if (!node || typeof node !== 'object') {
        return node
    }

    const input = node as Record<string, unknown>
    const output: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(input)) {
        if (key === '$ref' && typeof value === 'string') {
            output[key] = value.replace('#/components/schemas/', '#/$defs/')
        } else {
            output[key] = rewriteComponentRefs(value)
        }
    }
    return output
}

async function main() {
    const unit = typia.json.schema<ClawrModule, '3.1'>()

    const schema: JsonSchema = {
        ...(rewriteComponentRefs(unit.schema) as JsonSchema),
        $schema: 'https://json-schema.org/draft/2020-12/schema',
    }

    if (unit.components && Object.keys(unit.components).length > 0) {
        schema.$defs = rewriteComponentRefs(unit.components.schemas)
    }

    const outPath = path.resolve(
        __dirname,
        '..',
        '..',
        'dist',
        'cir.schema.json',
    )

    await fs.mkdir(path.dirname(outPath), { recursive: true })
    await fs.writeFile(outPath, JSON.stringify(schema, null, 2) + '\n')

    await updateVSCodeSchemaSettings(schema)
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
})

async function updateVSCodeSchemaSettings(schema: JsonSchema) {
    const settingsPath = path.resolve(__dirname, '../../.vscode/settings.json')
    const settings = await loadVSCodeSettings()
    settings['json.schemas'] = [
        {
            url: 'http://clawr.lang/schema/cir/DRAFT-0',
            schema,
        },
    ]

    await fs.writeFile(settingsPath, JSON.stringify(settings), 'utf-8')

    async function loadVSCodeSettings() {
        try {
            return JSON.parse(await fs.readFile(settingsPath, 'utf-8'))
        } catch (error) {
            return {}
        }
    }
}
