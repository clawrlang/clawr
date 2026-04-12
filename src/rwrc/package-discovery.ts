import fs from 'fs'
import path from 'path'

/**
 * Recursively find all .clawr files in a directory tree.
 * Returns a list of absolute file paths.
 */
export async function findClawrFiles(rootDir: string): Promise<string[]> {
    const result: string[] = []
    async function walk(dir: string) {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true })
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name)
            if (entry.isDirectory()) {
                await walk(fullPath)
            } else if (entry.isFile() && entry.name.endsWith('.clawr')) {
                result.push(fullPath)
            }
        }
    }
    await walk(rootDir)
    return result
}
