import { describe, expect, it } from 'bun:test'
import { newSemanticContext, someCodeSpan } from '../../util'
import { Query } from '../../../src/model/query'
import { IntegerLiteral } from '../../../src/model/integer-literal'

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
            name: {
                baseName: 'foo',
                labels: [],
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
                    value: IntegerLiteral.create({
                        value: 42n,
                        span: someCodeSpan,
                    }),
                },
            ],
            span: someCodeSpan,
        })
        const context = newSemanticContext()
        expect(query.toCIRExpression(context)).toMatchObject({
            kind: 'CALL_FUNC',
            name: {
                baseName: 'foo',
                labels: ['x'],
            },
            arguments: [
                {
                    kind: 'INTEGER_LITERAL',
                    value: '42',
                },
            ],
        })
    })
})
