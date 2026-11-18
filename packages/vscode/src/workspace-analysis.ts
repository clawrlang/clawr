import * as vscode from 'vscode'
import { posix } from 'node:path'
import { analyzeProgram, AnalyzedDocument } from './analyze-program'
import { toRange } from './spans'

/**
 * Reads a `manifest.json` identifying the standard library's own sources.
 * Returns the listed source names in manifest order, or undefined when the
 * file is missing or is not a standard library manifest.
 */
async function readStandardLibraryManifest(
    uri: vscode.Uri,
): Promise<string[] | undefined> {
    try {
        const manifest: unknown = JSON.parse(
            Buffer.from(await vscode.workspace.fs.readFile(uri)).toString(
                'utf8',
            ),
        )
        const sources =
            manifest && typeof manifest === 'object' && 'sources' in manifest
                ? manifest.sources
                : undefined
        if (!Array.isArray(sources) || sources.length === 0) return undefined
        const names = sources.filter(
            (name): name is string =>
                typeof name === 'string' &&
                name.endsWith('.clawr') &&
                !name
                    .split('/')
                    .some((part) => !part || part === '.' || part === '..'),
        )
        return names.length === sources.length ? names : undefined
    } catch {
        return undefined
    }
}

export class WorkspaceAnalysis implements vscode.Disposable {
    readonly collection = vscode.languages.createDiagnosticCollection('clawr')
    private readonly changed = new vscode.EventEmitter<void>()
    readonly onDidChange = this.changed.event
    private revision = 0
    private readonly cache = new Map<
        string,
        Promise<Map<string, AnalyzedDocument>>
    >()

    invalidate(): void {
        this.revision++
        this.cache.clear()
        this.changed.fire()
        void this.publish().catch((error: unknown) => {
            console.error('Clawr workspace analysis failed', error)
            void vscode.window.showErrorMessage(
                `Clawr workspace analysis failed: ${error instanceof Error ? error.message : String(error)}`,
            )
        })
    }

    async document(document: vscode.TextDocument): Promise<AnalyzedDocument> {
        const folder = vscode.workspace.getWorkspaceFolder(document.uri)
        if (folder) {
            const revision = this.revision
            const result = await this.folder(folder)
            if (revision !== this.revision) return this.document(document)
            const found = result.get(document.uri.toString())
            if (found) return found
        }
        const stdlib = await this.standardLibraryGroup(document)
        const found = stdlib?.get(document.uri.toString())
        if (found) return found
        return analyzeProgram([
            { name: document.uri.toString(), source: document.getText() },
        ]).get(document.uri.toString())!
    }

    /**
     * The standard library's own sources are identified by a sibling
     * `manifest.json` listing them. They are analyzed together as the
     * stdlib itself rather than against the compiled stdlib.
     *
     * TODO: Revisit when package support defines a general mechanism.
     */
    private async standardLibraryGroup(
        document: vscode.TextDocument,
    ): Promise<Map<string, AnalyzedDocument> | undefined> {
        const directory = document.uri.with({
            path: posix.dirname(document.uri.path),
        })
        const names = await readStandardLibraryManifest(
            vscode.Uri.joinPath(directory, 'manifest.json'),
        )
        if (!names) return undefined
        const uris = names.map((name) => vscode.Uri.joinPath(directory, name))
        if (!uris.some((uri) => uri.toString() === document.uri.toString()))
            return undefined
        const open = new Map(
            vscode.workspace.textDocuments.map((item) => [
                item.uri.toString(),
                item,
            ]),
        )
        try {
            const sources = await Promise.all(
                uris.map(async (uri) => ({
                    name: uri.toString(),
                    source:
                        open.get(uri.toString())?.getText() ??
                        Buffer.from(
                            await vscode.workspace.fs.readFile(uri),
                        ).toString('utf8'),
                })),
            )
            return analyzeProgram(sources, { standardLibrary: true })
        } catch {
            return undefined
        }
    }

    private async folder(
        folder: vscode.WorkspaceFolder,
    ): Promise<Map<string, AnalyzedDocument>> {
        const key = folder.uri.toString()
        let cached = this.cache.get(key)
        if (!cached) {
            cached = this.load(folder)
            this.cache.set(key, cached)
        }
        return cached
    }

    private async load(
        folder: vscode.WorkspaceFolder,
    ): Promise<Map<string, AnalyzedDocument>> {
        const [sources, markers, manifests] = await Promise.all([
            vscode.workspace.findFiles(
                new vscode.RelativePattern(folder, '**/*.clawr'),
            ),
            vscode.workspace.findFiles(
                new vscode.RelativePattern(folder, '**/.clawr-project'),
            ),
            vscode.workspace.findFiles(
                new vscode.RelativePattern(folder, '**/manifest.json'),
            ),
        ])
        const included = (uri: vscode.Uri): boolean =>
            vscode.workspace.getWorkspaceFolder(uri)?.uri.toString() ===
                folder.uri.toString() &&
            !vscode.workspace
                .asRelativePath(uri, false)
                .split('/')
                .some((part) =>
                    ['node_modules', 'dist', 'vendor', '.git', '.out'].includes(
                        part,
                    ),
                )
        const projectDirectories = new Set(
            markers.filter(included).map((uri) => posix.dirname(uri.path)),
        )
        const stdlibMembers = new Map<
            string,
            { group: string; index: number }
        >()
        await Promise.all(
            manifests.filter(included).map(async (uri) => {
                const names = await readStandardLibraryManifest(uri)
                if (!names) return
                const directory = uri.with({
                    path: posix.dirname(uri.path),
                })
                names.forEach((name, index) => {
                    stdlibMembers.set(
                        vscode.Uri.joinPath(directory, name).toString(),
                        { group: directory.toString(), index },
                    )
                })
            }),
        )
        const folderPath = folder.uri.path.replace(/\/+$/, '') || '/'
        const uris = sources.filter(included).sort((a, b) =>
            a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
        )
        const open = new Map(
            vscode.workspace.textDocuments.map((document) => [
                document.uri.toString(),
                document,
            ]),
        )
        const loaded = await Promise.all(
            uris.map(async (uri) => ({
                uri,
                name: uri.toString(),
                source:
                    open.get(uri.toString())?.getText() ??
                    Buffer.from(
                        await vscode.workspace.fs.readFile(uri),
                    ).toString('utf8'),
            })),
        )
        const groups = new Map<string, typeof loaded>()
        for (const source of loaded) {
            const stdlib = stdlibMembers.get(source.name)
            if (stdlib) {
                const key = `stdlib:${stdlib.group}`
                const group = groups.get(key) ?? []
                group.push(source)
                groups.set(key, group)
                continue
            }
            let directory = posix.dirname(source.uri.path)
            let project: string | undefined
            if (!source.uri.path.endsWith('.script.clawr')) {
                while (directory.length >= folderPath.length) {
                    if (projectDirectories.has(directory)) {
                        project = directory
                        break
                    }
                    const parent = posix.dirname(directory)
                    if (parent === directory) break
                    directory = parent
                }
            }
            const key =
                project === undefined
                    ? `file:${source.name}`
                    : `project:${project}`
            const group = groups.get(key) ?? []
            group.push(source)
            groups.set(key, group)
        }
        const results = new Map<string, AnalyzedDocument>()
        for (const [key, group] of groups) {
            const standardLibrary = key.startsWith('stdlib:')
            if (standardLibrary)
                // The stdlib compiles in manifest order.
                group.sort(
                    (a, b) =>
                        stdlibMembers.get(a.name)!.index -
                        stdlibMembers.get(b.name)!.index,
                )
            for (const [name, result] of analyzeProgram(group, {
                standardLibrary,
            }))
                results.set(name, result)
        }
        return results
    }

    private async publish(): Promise<void> {
        const revision = this.revision
        const results = await Promise.all(
            (vscode.workspace.workspaceFolders ?? []).map((folder) =>
                this.folder(folder),
            ),
        )
        const included = new Set(
            results.flatMap((result) => [...result.keys()]),
        )
        const standalone = await Promise.all(
            vscode.workspace.textDocuments
                .filter(
                    (document) =>
                        document.languageId === 'clawr' &&
                        !included.has(document.uri.toString()),
                )
                .map(
                    async (document) =>
                        [
                            document.uri.toString(),
                            await this.document(document),
                        ] as const,
                ),
        )
        if (revision !== this.revision) return
        this.collection.clear()
        for (const [name, result] of [
            ...results.flatMap((map) => [...map]),
            ...standalone,
        ]) {
            this.collection.set(
                vscode.Uri.parse(name),
                result.diagnostics.map(
                    (diagnostic) =>
                        new vscode.Diagnostic(
                            toRange(diagnostic.span),
                            diagnostic.message,
                            diagnostic.severity === 'error'
                                ? vscode.DiagnosticSeverity.Error
                                : vscode.DiagnosticSeverity.Warning,
                        ),
                ),
            )
        }
    }

    dispose(): void {
        this.changed.dispose()
        this.collection.dispose()
    }
}
