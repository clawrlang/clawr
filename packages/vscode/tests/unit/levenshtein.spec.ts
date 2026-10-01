import { describe, expect, it } from 'bun:test'
import { levenshteinDistance } from '../../src/levenshtein'

describe('levenshteinDistance', () => {
    it('is 0 for identical strings', () => {
        expect(levenshteinDistance('field', 'field')).toBe(0)
    })

    it('counts a single substitution', () => {
        expect(levenshteinDistance('feild', 'field')).toBe(2)
    })

    it('counts insertions/deletions', () => {
        expect(levenshteinDistance('fiel', 'field')).toBe(1)
        expect(levenshteinDistance('field', 'fiel')).toBe(1)
    })

    it('handles empty strings', () => {
        expect(levenshteinDistance('', 'abc')).toBe(3)
        expect(levenshteinDistance('abc', '')).toBe(3)
    })
})
