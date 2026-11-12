import * as vscode from 'vscode'
import { analyzeProgram, AnalyzedDocument } from './analyze-program'
import { parseDocument } from './parse-document'
import { toRange } from './spans'

function isStringArray(value: unknown): value is string[] {
    return (
        Array.isArray(value) && value.every((item) => typeof item === 'string')
    )
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
        return { ...parseDocument(document.getText()), definitions: [] }
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
        const configured = vscode.workspace
            .getConfiguration('clawr', folder.uri)
            .get<unknown>('sourceFiles', [])
        if (!isStringArray(configured))
            throw new Error('clawr.sourceFiles must be an array of paths')
        let uris: vscode.Uri[]
        if (configured.length) {
            if (
                new Set(configured).size !== configured.length ||
                configured.some(
                    (name) =>
                        !name.endsWith('.clawr') ||
                        name.startsWith('/') ||
                        name.includes('\\') ||
                        name
                            .split('/')
                            .some(
                                (part) =>
                                    !part || part === '.' || part === '..',
                            ),
                )
            )
                throw new Error(
                    'clawr.sourceFiles must contain unique relative .clawr paths',
                )
            uris = configured.map((name) =>
                vscode.Uri.joinPath(folder.uri, name),
            )
            if (new Set(uris.map((uri) => uri.toString())).size !== uris.length)
                throw new Error('clawr.sourceFiles contains duplicate paths')
        } else {
            uris = await vscode.workspace.findFiles(
                new vscode.RelativePattern(folder, '**/*.clawr'),
            )
            uris = uris.filter((uri) => {
                const relative = vscode.workspace.asRelativePath(uri, false)
                return (
                    vscode.workspace.getWorkspaceFolder(uri)?.uri.toString() ===
                        folder.uri.toString() &&
                    !relative
                        .split('/')
                        .some((part) =>
                            [
                                'node_modules',
                                'dist',
                                'vendor',
                                '.git',
                                '.out',
                            ].includes(part),
                        )
                )
            })
            uris.sort((a, b) =>
                a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
            )
        }
        const open = new Map(
            vscode.workspace.textDocuments.map((document) => [
                document.uri.toString(),
                document,
            ]),
        )
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
        return analyzeProgram(sources)
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
