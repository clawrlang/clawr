import * as vscode from 'vscode'
import { posix } from 'node:path'
import { analyzeProgram, AnalyzedDocument } from './analyze-program'
import { toRange } from './spans'

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
        return analyzeProgram([
            { name: document.uri.toString(), source: document.getText() },
        ]).get(document.uri.toString())!
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
        const [sources, markers] = await Promise.all([
            vscode.workspace.findFiles(
                new vscode.RelativePattern(folder, '**/*.clawr'),
            ),
            vscode.workspace.findFiles(
                new vscode.RelativePattern(folder, '**/.clawr-project'),
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
        for (const group of groups.values())
            for (const [name, result] of analyzeProgram(group))
                results.set(name, result)
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
