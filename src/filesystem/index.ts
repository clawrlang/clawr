import path from 'node:path'
import fs from 'fs'
import os from 'os'

/**
 * A new file path that can represent paths that don't exist on the filesystem yet. Used for intermediate files during compilation and test harness generation. For paths that must exist, use `RealFilePath` instead.
 */
export class NewFilePath {
    get absolutePath(): string {
        return this.root
            ? path.resolve(this.root.absolutePath, this.relativePath)
            : path.resolve(this.relativePath)
    }

    get isDirectory(): boolean {
        return fs.statSync(this.absolutePath).isDirectory()
    }

    get basename(): string {
        return path.basename(this.absolutePath)
    }

    get basenameWithoutExtension(): string {
        return path.basename(this.absolutePath, path.extname(this.absolutePath))
    }

    get parent(): NewFilePath {
        const parentPath = path.dirname(this.absolutePath)
        return new NewFilePath(parentPath)
    }

    private constructor(
        private relativePath: string,
        private root?: NewFilePath,
    ) {
        if (!root && !path.isAbsolute(relativePath))
            throw new Error('Absolute path required when no root is provided')
    }

    static resolve(...segments: string[]): NewFilePath {
        const resolved = path.resolve(...segments)
        // fs.accessSync(resolved) // throws if path doesn't exist
        return new NewFilePath(resolved)
    }

    subpath(name: string) {
        return new NewFilePath(name, this)
    }

    equals(other: NewFilePath): boolean {
        return this.absolutePath === other.absolutePath
    }

    toString(): string {
        return this.absolutePath
    }
}

/**
 * A file path that must exist on the filesystem. Used for test discovery and
 * execution, where we need to read test files and execute compiled test
 * harnesses. For paths that may not exist yet, use `NewFilePath` instead.
 */
export class RealFilePath {
    get absolutePath(): string {
        return this.filePath.absolutePath
    }

    get isDirectory(): boolean {
        return this.filePath.isDirectory
    }

    get basename(): string {
        return this.filePath.basename
    }

    get basenameWithoutExtension(): string {
        return this.filePath.basenameWithoutExtension
    }

    get parent(): RealFilePath {
        return new RealFilePath(this.filePath.parent)
    }

    private constructor(public filePath: NewFilePath) {}

    static async createTemporary(prefix: string): Promise<RealFilePath> {
        const tempDir = await fs.promises.mkdtemp(
            path.join(os.tmpdir(), prefix),
        )
        return this.resolve(tempDir)
    }

    static resolve(...segments: string[]): RealFilePath {
        const resolved = NewFilePath.resolve(...segments)
        fs.accessSync(resolved.absolutePath) // throws if path doesn't exist
        return new RealFilePath(resolved)
    }

    static resolveNew(filePath: NewFilePath): RealFilePath {
        fs.accessSync(filePath.absolutePath) // throws if path doesn't exist
        return new RealFilePath(filePath)
    }

    realSubpath(name: string): RealFilePath {
        const newPath = this.filePath.subpath(name)
        return RealFilePath.resolveNew(newPath)
    }

    newSubpath(name: string) {
        return this.filePath.subpath(name)
    }

    async readFile(): Promise<string> {
        return await fs.promises.readFile(this.absolutePath, 'utf-8')
    }

    async writeFile(filename: string, content: string): Promise<RealFilePath> {
        const filePath = this.filePath.subpath(filename)
        await fs.promises.writeFile(filePath.absolutePath, content)
        return new RealFilePath(filePath)
    }

    equals(other: RealFilePath): boolean {
        return this.filePath.equals(other.filePath)
    }

    toString(): string {
        return this.absolutePath
    }
}
