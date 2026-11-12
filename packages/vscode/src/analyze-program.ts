import { DataDeclaration } from '@clawr/frontend/model/data-declaration'
import { InterfaceDeclaration } from '@clawr/frontend/model/interface-declaration'
import { ObjectDeclaration } from '@clawr/frontend/model/object-declaration'
import { Scope } from '@clawr/frontend/model/scope'
import { TypeAliasDeclaration } from '@clawr/frontend/model/type-alias-declaration'
import { parseProgram, ProgramSource } from '@clawr/frontend/program'
import { createStandardLibraryScope } from '@clawr/frontend/stdlib'
import { SourceError, SourceErrorCollection } from '@clawr/frontend/tools'
import type { SourceCodeSpan } from '@clawr/frontend/tools'
import type { DefinitionRecorder } from '@clawr/frontend/tools/definitions'
import type { HighlightRecorder } from '@clawr/frontend/tools/highlights'
import { ParsedDocument } from './parse-document'

export type DefinitionReference = {
    span: SourceCodeSpan
    definition: SourceCodeSpan
}

export type AnalyzedDocument = ParsedDocument & {
    definitions: DefinitionReference[]
}

export function analyzeProgram(
    sources: ProgramSource[],
): Map<string, AnalyzedDocument> {
    const results = new Map<string, AnalyzedDocument>(
        sources.map(({ name }) => [
            name,
            {
                diagnostics: [],
                highlights: [],
                definitions: [],
            },
        ]),
    )
    const types = new Map<string, SourceCodeSpan>()
    const typeReferences: { name: string; span: SourceCodeSpan }[] = []
    const highlightRecorder: HighlightRecorder = {
        record(kind, span, modifiers) {
            if (span.start.source)
                results.get(span.start.source)?.highlights.push({
                    kind,
                    span,
                    modifiers: modifiers ?? [],
                })
        },
    }
    const definitionRecorder: DefinitionRecorder = {
        typeReference(name, span) {
            typeReferences.push({ name, span })
        },
        functionReference(span, definition) {
            if (
                span.start.source &&
                definition.start.source &&
                results.has(definition.start.source)
            )
                results
                    .get(span.start.source)
                    ?.definitions.push({ span, definition })
        },
    }
    let remaining = [...sources]
    while (remaining.length) {
        const scope = Scope.createRoot(createStandardLibraryScope())
        typeReferences.length = 0
        types.clear()
        for (const result of results.values()) {
            result.highlights.length = 0
            result.definitions.length = 0
        }
        let module
        try {
            module = parseProgram(remaining, scope, false, {
                highlightRecorder,
                definitionRecorder,
            })
        } catch (error) {
            if (!(error instanceof SourceError)) throw error
            const name = error.span.start.source
            if (!name || !remaining.some((source) => source.name === name))
                throw error
            results.get(name)!.diagnostics.push({
                message: error.message,
                span: error.span,
                severity: 'error',
            })
            remaining = remaining.filter((source) => source.name !== name)
            continue
        }
        for (const declaration of module.declarations) {
            if (
                declaration instanceof TypeAliasDeclaration &&
                declaration.nameSpan
            )
                types.set(declaration.name, declaration.nameSpan)
            else if (
                (declaration instanceof ObjectDeclaration ||
                    declaration instanceof InterfaceDeclaration) &&
                declaration.nameSpan
            )
                types.set(declaration.name.name, declaration.nameSpan)
            else if (declaration instanceof DataDeclaration && declaration.span)
                types.set(declaration.name.name, declaration.span)
        }
        try {
            module.toCIR({ scope, highlightRecorder, definitionRecorder })
        } catch (error) {
            const errors =
                error instanceof SourceErrorCollection
                    ? error.errors
                    : error instanceof SourceError
                      ? [error]
                      : undefined
            if (!errors) throw error
            for (const item of errors) {
                const name = item.span.start.source
                if (!name || !results.has(name)) throw item
                results.get(name)!.diagnostics.push({
                    message: item.message,
                    span: item.span,
                    severity: 'error',
                })
            }
        }
        break
    }
    for (const { name, span } of typeReferences) {
        const definition = types.get(name)
        if (definition && span.start.source)
            results
                .get(span.start.source)
                ?.definitions.push({ span, definition })
    }
    return results
}
