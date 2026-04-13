import fs from 'fs'
import { RealFilePath } from '../filesystem'

/**
 * Recursively find all .clawr files in a directory tree.
 */
export async function findClawrFiles(
    rootDir: RealFilePath,
): Promise<RealFilePath[]> {
    const result: RealFilePath[] = []
    async function walk(dir: RealFilePath) {
        const entries = await fs.promises.readdir(dir.absolutePath, {
            withFileTypes: true,
        })
        for (const entry of entries) {
            const fullPath = dir.realSubpath(entry.name)
            if (entry.isDirectory()) {
                await walk(fullPath)
            } else if (entry.isFile() && entry.name.endsWith('.clawr')) {
                result.push(RealFilePath.resolve(fullPath.absolutePath))
            }
        }
    }
    await walk(rootDir)
    return result
}
