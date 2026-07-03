import { describe, expect, it } from 'bun:test'
import { newSemanticContext, someCodeSpan } from '../../util'
import { Query } from '../../../src/model/query'

describe('Query', () => {
    it('converts to CIR', () => {
        const query = Query.create({
            baseName: 'foo',
            arguments: [],
            span: someCodeSpan,
        })
        const context = newSemanticContext()
        expect(query.toCIRExpression(context)).toMatchObject({
            kind: 'CALL_FUNC',
            signature: {
                baseName: 'foo',
                parameters: [],
            },
            arguments: [],
        })
    })

    it('includes argument labels in signature', () => {
        const query = Query.create({
            baseName: 'foo',
            arguments: [
                {
                    label: 'x',
                    value: Query.create({
                        baseName: 'bar',
                        arguments: [],
                        span: someCodeSpan,
                    }),
                },
            ],
            span: someCodeSpan,
        })
        const context = newSemanticContext()
        expect(query.toCIRExpression(context)).toMatchObject({
            kind: 'CALL_FUNC',
            signature: {
                baseName: 'foo',
                parameters: [{ label: 'x', type: 'unknown' }],
            },
            arguments: [
                {
                    kind: 'CALL_FUNC',
                    signature: {
                        baseName: 'bar',
                        parameters: [],
                    },
                    arguments: [],
                },
            ],
        })
    })
})
