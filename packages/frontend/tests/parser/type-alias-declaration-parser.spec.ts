import { TokenStream } from '@/lexer'
import { Scope } from '@/model/scope'
import { RealSet } from '@/model/value-set'
import { ModuleParser } from '@/parser/module-parser'
import { createStandardLibraryScope } from '@/stdlib'
import { describe, expect, it } from 'bun:test'

describe('Named subset and type declarations', () => {
    it('resolves local aliases and omits them from CIR', () => {
        const scope = Scope.createRoot()
        const module = ModuleParser.create({ scope }).parse(
            TokenStream.read(`
                subset probability = real(0.0...1.0)
                type percentage = probability scale 2
                @main {
                    const p: percentage = 0.25
                }
            `),
        )

        const cir = module.toCIR({ scope })
        const probability = scope.typeAlias('probability')
        const percentage = scope.typeAlias('percentage')
        expect(probability).toBeInstanceOf(RealSet)
        expect(percentage).toBeInstanceOf(RealSet)
        if (!(probability instanceof RealSet))
            throw new Error('Expected probability to be a RealSet')
        if (!(percentage instanceof RealSet))
            throw new Error('Expected percentage to be a RealSet')
        expect(probability.min?.toString()).toBe('0')
        expect(percentage.precision).toEqual({
            kind: 'scale',
            digits: 2,
            base: 'dec',
        })
        expect(cir.declarations).toEqual([])
        expect(cir.startBlock).toHaveLength(1)
    })

    it('loads built-in aliases from the implicit clawr stdlib scope', () => {
        const standardLibrary = createStandardLibraryScope()
        const scope = Scope.createRoot(standardLibrary)
        const module = ModuleParser.create({ scope }).parse(
            TokenStream.read(`
                @main {
                    const count: natural = 5
                    const x: binary32 = 1.5
                    const y: binary64 = 2.5
                }
            `),
        )

        const cir = module.toCIR({ scope })
        const binary32 = standardLibrary.typeAlias('binary32')
        const binary64 = standardLibrary.typeAlias('binary64')
        expect(binary32).toBeInstanceOf(RealSet)
        expect(binary64).toBeInstanceOf(RealSet)
        if (!(binary32 instanceof RealSet))
            throw new Error('Expected binary32 to be a RealSet')
        if (!(binary64 instanceof RealSet))
            throw new Error('Expected binary64 to be a RealSet')
        expect(standardLibrary.namespace).toBe('clawr')
        expect(binary32.precision).toEqual({
            kind: 'sig',
            digits: 24,
            base: 'bin',
        })
        expect(binary64.precision).toEqual({
            kind: 'sig',
            digits: 53,
            base: 'bin',
        })
        expect(cir.declarations).toEqual([])
        expect(cir.startBlock).toHaveLength(3)
    })

    it('reports duplicate aliases', () => {
        const scope = Scope.createRoot()
        expect(() =>
            ModuleParser.create({ scope }).parse(
                TokenStream.read(`
                    subset count = integer(0...)
                    subset count = integer(1...)
                `),
            ),
        ).toThrow('Duplicate type alias: count')
    })

    it('does not allow redefining primitive types', () => {
        expect(() =>
            ModuleParser.create({ scope: Scope.createRoot() }).parse(
                TokenStream.read('subset integer = integer'),
            ),
        ).toThrow('Cannot redefine built-in type integer')
    })

    it('restricts subsets to the supported primitive universes', () => {
        const scope = Scope.createRoot()
        expect(() =>
            ModuleParser.create({ scope }).parse(
                TokenStream.read('subset text = string'),
            ),
        ).toThrow('A subset must be based on integer, real, or truthvalue')
    })
})
