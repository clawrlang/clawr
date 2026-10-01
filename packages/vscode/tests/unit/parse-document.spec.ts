import { describe, expect, it } from 'bun:test'
import { parseDocument } from '../../src/parse-document'

describe('parseDocument', () => {
    it('records no diagnostics for valid source', () => {
        const { diagnostics } = parseDocument('func f() => 42')
        expect(diagnostics).toEqual([])
    })

    it('records a diagnostic for an unknown variable', () => {
        const { diagnostics } = parseDocument(
            '@main {\n    const y: integer = unknownVar\n}',
        )
        expect(diagnostics.length).toBeGreaterThan(0)
        expect(diagnostics[0].severity).toBe('error')
        expect(diagnostics[0].message).toContain('unknownVar')
    })

    it('records a highlight for a declared variable', () => {
        const { highlights } = parseDocument(
            '@main {\n    const x: integer = 1\n}',
        )
        const declaration = highlights.find(
            (h) => h.kind === 'variable' && h.modifiers.includes('declaration'),
        )
        expect(declaration).toBeDefined()
        expect(declaration!.modifiers).toContain('readonly')
    })

    it('records a highlight for a variable reference', () => {
        const { highlights } = parseDocument(
            '@main {\n    const x: integer = 1\n    print(x)\n}',
        )
        const references = highlights.filter(
            (h) =>
                h.kind === 'variable' && !h.modifiers.includes('declaration'),
        )
        expect(references.length).toBeGreaterThan(0)
    })
})
