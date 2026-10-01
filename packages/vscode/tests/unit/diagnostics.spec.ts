import { describe, expect, it } from 'bun:test'
import { CollectingErrorReporter } from '../../src/diagnostics'

describe('CollectingErrorReporter', () => {
    const span = { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } }

    it('collects warnings without throwing', () => {
        const reporter = new CollectingErrorReporter()
        reporter.reportWarning('careful', span)
        expect(reporter.diagnostics).toEqual([
            { message: 'careful', span, severity: 'warning' },
        ])
    })

    it('collects errors without throwing', () => {
        const reporter = new CollectingErrorReporter()
        reporter.reportError('bad', span)
        expect(reporter.diagnostics).toEqual([
            { message: 'bad', span, severity: 'error' },
        ])
    })

    it('buffers fatal errors as candidates instead of throwing them away', () => {
        const reporter = new CollectingErrorReporter()
        expect(() => reporter.reportFatalError('boom', span)).toThrow('boom')
        expect(reporter.diagnostics).toEqual([])
        expect(reporter.fatalCandidates).toEqual([
            { message: 'boom', span, severity: 'error' },
        ])
    })
})
