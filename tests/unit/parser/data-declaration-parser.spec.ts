import { describe, expect, it } from 'bun:test'
import { TokenStream } from '../../../src/lexer'
import { TestErrorReporter } from '../../util'
import { DataDeclarationParser } from '../../../src/parser/data-declaration-parser'
import {
    ExplicitIntegerValueSet,
    ExplicitTruthValueSet,
} from '../../../src/model/explicit-value-set'

describe('DataDeclarationParser', () => {
    it('parses a data declaration with default-mutability', () => {
        const code = `
            data MyData {
                field1: integer
                field2: truthvalue
            }`
        const errorReporter = new TestErrorReporter()
        const tokenStream = TokenStream.read(code, errorReporter)
        const parser = DataDeclarationParser.create({ errorReporter })
        const result = parser.parse(tokenStream)
        expect(result).toMatchObject({
            name: { name: 'MyData' },
            fields: [
                { name: 'field1', semantics: 'mut' },
                { name: 'field2', semantics: 'mut' },
            ],
        })
        expect(result.fields[0].valueSet).toBeInstanceOf(
            ExplicitIntegerValueSet,
        )
        expect(result.fields[1].valueSet).toBeInstanceOf(ExplicitTruthValueSet)
    })

    it('parses a data declaration with mixed semantics', () => {
        const code = `
            data MyData {
                ref field1: integer
                const field2: truthvalue
            }`
        const errorReporter = new TestErrorReporter()
        const tokenStream = TokenStream.read(code, errorReporter)
        const parser = DataDeclarationParser.create({ errorReporter })
        const result = parser.parse(tokenStream)
        expect(result).toMatchObject({
            name: { name: 'MyData' },
            fields: [
                { name: 'field1', semantics: 'ref' },
                { name: 'field2', semantics: 'const' },
            ],
        })
        expect(result.fields[0].valueSet).toBeInstanceOf(
            ExplicitIntegerValueSet,
        )
        expect(result.fields[1].valueSet).toBeInstanceOf(ExplicitTruthValueSet)
    })
})
